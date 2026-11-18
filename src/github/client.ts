import { CHANGE_STATUS_MUTATION, FOLLOWERS_QUERY, FOLLOWING_QUERY, VIEWER_QUERY } from './queries';
import type { GitHubUser, Relation, SetStatusInput, UserStatus, Viewer } from './types';

const ENDPOINT = 'https://api.github.com/graphql';
/** GitHub returns at most 100 nodes per connection page. */
const PAGE_SIZE = 100;
/** Hard upper bound for the `myStatus.maxUsers` setting (50 requests per list). */
export const MAX_USERS = 5000;

export class UnauthorizedError extends Error {
  constructor() {
    super('GitHub rejected the access token (401).');
  }
}

export class GitHubError extends Error {}

type FetchFn = typeof fetch;

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async getViewer(): Promise<Viewer> {
    const data = await this.request<{ viewer: Viewer }>(VIEWER_QUERY);
    return data.viewer;
  }

  /**
   * Loads up to `limit` users (capped at MAX_USERS), 100 per request.
   * `totalCount` is the real number on GitHub, which may exceed `users.length`.
   */
  async getUsers(relation: Relation, limit: number): Promise<{ users: GitHubUser[]; totalCount: number }> {
    const query = relation === 'followers' ? FOLLOWERS_QUERY : FOLLOWING_QUERY;
    const max = Math.min(Math.max(1, Math.floor(limit)), MAX_USERS);
    const users: GitHubUser[] = [];
    let totalCount = 0;
    let after: string | null = null;
    while (users.length < max) {
      const first = Math.min(PAGE_SIZE, max - users.length);
      const data: ConnectionResponse = await this.request<ConnectionResponse>(query, { first, after });
      const conn = data.viewer.connection;
      totalCount = conn.totalCount;
      users.push(...conn.nodes.filter((n): n is GitHubUser => !!n));
      if (!conn.pageInfo.hasNextPage) {
        break;
      }
      after = conn.pageInfo.endCursor;
    }
    return { users, totalCount };
  }

  /** Passing an empty input clears the status. */
  async setStatus(input: SetStatusInput): Promise<UserStatus | null> {
    const data = await this.request<{ changeUserStatus: { status: UserStatus | null } }>(
      CHANGE_STATUS_MUTATION,
      { input },
    );
    return data.changeUserStatus.status;
  }

  private async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await this.fetchFn(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vscode-mystatus',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 401) {
      throw new UnauthorizedError();
    }
    if (!res.ok) {
      const reset = res.headers.get('x-ratelimit-reset');
      if ((res.status === 403 || res.status === 429) && reset) {
        const when = new Date(Number(reset) * 1000).toLocaleTimeString();
        throw new GitHubError(`GitHub rate limit exceeded. Try again after ${when}.`);
      }
      throw new GitHubError(`GitHub API error ${res.status}: ${res.statusText}`);
    }

    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) {
      throw new GitHubError(body.errors.map((e) => e.message).join('; '));
    }
    if (!body.data) {
      throw new GitHubError('GitHub API returned no data.');
    }
    return body.data;
  }
}

interface ConnectionResponse {
  viewer: {
    connection: {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: (GitHubUser | null)[];
    };
  };
}
