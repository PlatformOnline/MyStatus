import * as vscode from 'vscode';
import type { GitHubUser, Relation } from '../github/types';
import type { Store } from '../store';
import { displayName, UserItem } from './userItem';

/** Shared provider for the "Followers" and "Following" views. */
export class UserTreeProvider implements vscode.TreeDataProvider<UserItem>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  readonly view: vscode.TreeView<UserItem>;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly relation: Relation,
    private readonly store: Store,
  ) {
    this.view = vscode.window.createTreeView(`mystatus.${relation}`, { treeDataProvider: this });
    this.disposables.push(
      this.view,
      this.emitter,
      store.onDidChange(() => this.update()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('myStatus.maxUsers')) {
          void store.refreshList(relation);
        } else if (e.affectsConfiguration('myStatus')) {
          this.update();
        }
      }),
    );
  }

  getTreeItem(element: UserItem): UserItem {
    return element;
  }

  getChildren(element?: UserItem): UserItem[] {
    if (element) {
      return [];
    }
    const users = this.store.lists[this.relation].users ?? [];
    return this.arrange(users).map((u) => new UserItem(u, this.relation));
  }

  private arrange(users: GitHubUser[]): GitHubUser[] {
    const cfg = vscode.workspace.getConfiguration('myStatus');
    let result = users;
    if (cfg.get<boolean>('hideUsersWithoutStatus')) {
      result = result.filter((u) => u.status);
    }
    // Sort by what is shown (full name or username), locale-aware so Ç/Ş/Ö etc. sort correctly.
    const byName = (a: GitHubUser, b: GitHubUser) =>
      displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
    if (cfg.get<string>('sortBy') === 'name') {
      return [...result].sort(byName);
    }
    const rank = (u: GitHubUser) => (u.status?.indicatesLimitedAvailability ? 0 : u.status ? 1 : 2);
    return [...result].sort((a, b) => rank(a) - rank(b) || byName(a, b));
  }

  private update(): void {
    const list = this.store.lists[this.relation];
    // "42", or "1,000 / 12,430" when myStatus.maxUsers cut the list short.
    const loaded = list.users?.length;
    const total = list.totalCount ?? loaded;
    this.view.description =
      loaded === undefined || total === undefined
        ? undefined
        : loaded < total
          ? `${loaded.toLocaleString()} / ${total.toLocaleString()}`
          : total.toLocaleString();
    if (list.error) {
      this.view.message = `⚠ ${list.error}`;
    } else if (list.loading && !list.users) {
      this.view.message = 'Loading…';
    } else if (list.users && list.users.length === 0) {
      this.view.message = this.relation === 'followers' ? 'No followers yet.' : 'You are not following anyone.';
    } else if (list.users && this.getChildren().length === 0) {
      this.view.message = 'Nobody here has a status set.';
    } else {
      this.view.message = undefined;
    }
    this.emitter.fire();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
