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

/**
 * Single source of truth for everything the views render.
 * Views subscribe to `onDidChange` and read state synchronously.
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

  constructor(private readonly auth: Auth) {
    this.sub = auth.onDidChangeSession((s) => {
      if (s) {
        void this.refreshAll();
      } else {
        this.clear();
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
    const client = this.client();
    if (!client) {
      return;
    }
    try {
      this.viewer = await client.getViewer();
      this.viewerError = undefined;
    } catch (e) {
      this.viewerError = await this.handleError(e);
    }
    this.fire();
  }

  async refreshList(relation: Relation): Promise<void> {
    const client = this.client();
    if (!client) {
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
      const result = await client.getUsers(relation, limit);
      list.users = result.users;
      list.totalCount = result.totalCount;
      list.error = undefined;
    } catch (e) {
      list.error = await this.handleError(e);
    } finally {
      list.loading = false;
      this.fire();
    }
  }

  /** Empty input clears the status. Throws on failure so the command can report it. */
  async setStatus(input: SetStatusInput): Promise<void> {
    const client = this.client();
    if (!client) {
      throw new Error('Not signed in.');
    }
    try {
      const status = await client.setStatus(input);
      if (this.viewer) {
        this.viewer = { ...this.viewer, status };
        this.fire();
      }
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        void this.auth.handleUnauthorized();
      }
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

  private client(): GitHubClient | undefined {
    const token = this.auth.current?.accessToken;
    return token ? new GitHubClient(token) : undefined;
  }

  private async handleError(e: unknown): Promise<string> {
    if (e instanceof UnauthorizedError) {
      void this.auth.handleUnauthorized();
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
