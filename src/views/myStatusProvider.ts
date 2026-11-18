import * as vscode from 'vscode';
import type { Store } from '../store';
import { formatExpiry } from '../util/format';
import { UserItem } from './userItem';

/** "My Status" view: the signed-in user plus a few detail rows. */
export class MyStatusProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  readonly view: vscode.TreeView<vscode.TreeItem>;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly store: Store) {
    this.view = vscode.window.createTreeView('mystatus.me', { treeDataProvider: this });
    this.disposables.push(
      this.view,
      this.emitter,
      store.onDidChange(() => {
        this.view.message = store.viewerError ? `⚠ ${store.viewerError}` : undefined;
        this.emitter.fire();
      }),
    );
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    const v = this.store.viewer;
    if (element || !v) {
      return [];
    }

    const me = new UserItem(v, 'me');
    me.description = me.description ?? 'No status set';
    me.command = { command: 'mystatus.setStatus', title: 'Set Status' };
    const items: vscode.TreeItem[] = [me];

    const s = v.status;
    if (s?.indicatesLimitedAvailability) {
      items.push(detail('Busy', 'circle-slash', 'Others see that you may be slow to respond'));
    }
    const exp = formatExpiry(s?.expiresAt);
    if (exp) {
      items.push(detail(`Clears ${exp}`, 'clock'));
    }
    items.push(
      detail(`${v.followers.totalCount} followers · ${v.following.totalCount} following`, 'organization'),
    );
    return items;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

function detail(label: string, icon: string, tooltip?: string): vscode.TreeItem {
  const item = new vscode.TreeItem(label);
  item.iconPath = new vscode.ThemeIcon(icon);
  item.tooltip = tooltip;
  return item;
}
