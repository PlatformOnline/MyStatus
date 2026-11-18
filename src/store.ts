import * as vscode from 'vscode';
import type { Auth } from './auth';
import { GitHubClient, MAX_USERS, UnauthorizedError } from './github/client';
import type { GitHubUser, Relation, SetStatusInput, Viewer } from './github/types';

export interface ListState {
  users: GitHubUser[] | undefined;
  /** Real total on GitHub; can be larger than users.length when capped by myStatus.maxUsers. */
  totalCount: number | undefined;
  loading: boolean;
  error: string | undefined;
}

/** The parts of Auth the store depends on (lets tests pass a fake). */
export type StoreAuth = Pick<Auth, 'current' | 'onDidChangeSession' | 'handleUnauthorized'>;

type ClientFactory = (token: string) => Pick<GitHubClient, 'getViewer' | 'getUsers' | 'setStatus'>;

/** A client bound to the session that was active when a request started. */
interface Request {
  client: ReturnType<ClientFactory>;
  token: string;
  generation: number;
}

/**
 * Single source of truth for everything the views render.
 * Views subscribe to `onDidChange` and read state synchronously.
 *
 * Every session change bumps `generation`; a request that finishes after the
 * session changed (sign-out, account switch) is discarded instead of writing
 * the previous account's data back into the views.
 */
export class Store implements vscode.Disposable {
  viewer: Viewer | undefined;
  viewerError: string | undefined;
  readonly lists: Record<Relation, ListState> = {
    followers: { users: undefined, totalCount: undefined, loading: false, error: undefined },
    following: { users: undefined, totalCount: undefined, loading: false, error: undefined },
  };

  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private readonly sub: vscode.Disposable;
  private generation = 0;

  constructor(
    private readonly auth: StoreAuth,
    private readonly createClient: ClientFactory = (token) => new GitHubClient(token),
  ) {
    this.sub = auth.onDidChangeSession((s) => {
      this.generation++;
      this.clear();
      if (s) {
        void this.refreshAll();
      }
    });
  }

  /** Looks a user up in both lists (used by the decoration provider). */
  findUser(relation: Relation, login: string): GitHubUser | undefined {
    return this.lists[relation].users?.find((u) => u.login === login);
  }

  async refreshAll(): Promise<void> {
    await Promise.all([this.refreshViewer(), this.refreshList('followers'), this.refreshList('following')]);
  }

  async refreshViewer(): Promise<void> {
    const req = this.request();
    if (!req) {
      return;
    }
    try {
      const viewer = await req.client.getViewer();
      if (!this.isCurrent(req)) {
        return;
      }
      this.viewer = viewer;
      this.viewerError = undefined;
    } catch (e) {
      if (!this.isCurrent(req)) {
        return;
      }
      this.viewerError = this.handleError(e, req);
    }
    this.fire();
  }

  async refreshList(relation: Relation): Promise<void> {
    const req = this.request();
    if (!req) {
      return;
    }
    const list = this.lists[relation];
    if (list.loading) {
      return;
    }
    list.loading = true;
    this.fire();
    try {
      const limit = vscode.workspace.getConfiguration('myStatus').get<number>('maxUsers', MAX_USERS);
      const result = await req.client.getUsers(relation, limit);
      if (!this.isCurrent(req)) {
        return;
      }
      list.users = result.users;
      list.totalCount = result.totalCount;
      list.error = undefined;
    } catch (e) {
      if (!this.isCurrent(req)) {
        return;
      }
      list.error = this.handleError(e, req);
    } finally {
      // A stale request must not touch `loading`: clear() already reset it and a
      // request for the new session may be running.
      if (this.isCurrent(req)) {
        list.loading = false;
        this.fire();
      }
    }
  }

  /** Empty input clears the status. Throws on failure so the command can report it. */
  async setStatus(input: SetStatusInput): Promise<void> {
    const req = this.request();
    if (!req) {
      throw new Error('Not signed in.');
    }
    try {
      const status = await req.client.setStatus(input);
      if (this.viewer && this.isCurrent(req)) {
        this.viewer = { ...this.viewer, status };
        this.fire();
      }
    } catch (e) {
      this.handleError(e, req);
      throw e;
    }
  }

  private clear(): void {
    this.viewer = undefined;
    this.viewerError = undefined;
    for (const l of Object.values(this.lists)) {
      l.users = undefined;
      l.totalCount = undefined;
      l.error = undefined;
      l.loading = false;
    }
    this.fire();
  }

  private request(): Request | undefined {
    const token = this.auth.current?.accessToken;
    return token ? { client: this.createClient(token), token, generation: this.generation } : undefined;
  }

  private isCurrent(req: Request): boolean {
    return req.generation === this.generation;
  }

  private handleError(e: unknown, req: Request): string {
    if (e instanceof UnauthorizedError) {
      void this.auth.handleUnauthorized(req.token);
    }
    return e instanceof Error ? e.message : String(e);
  }

  private fire(): void {
    void vscode.commands.executeCommand('setContext', 'mystatus.hasStatus', !!this.viewer?.status);
    this.emitter.fire();
  }

  dispose(): void {
    this.sub.dispose();
    this.emitter.dispose();
  }
}
