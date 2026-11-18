import * as vscode from 'vscode';
import type { Store } from '../store';
import { statusText } from '../util/format';
import { userTooltip } from './userItem';

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem('mystatus.status', vscode.StatusBarAlignment.Left, 50);
  private readonly disposables: vscode.Disposable[];

  constructor(private readonly store: Store) {
    this.item.name = 'MyStatus';
    this.item.command = 'mystatus.setStatus';
    this.disposables = [
      this.item,
      store.onDidChange(() => this.update()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration('myStatus.showStatusBarItem') ||
          e.affectsConfiguration('myStatus.highlightBusyInStatusBar')
        ) {
          this.update();
        }
      }),
    ];
    this.update();
  }

  private update(): void {
    const v = this.store.viewer;
    const enabled = vscode.workspace.getConfiguration('myStatus').get<boolean>('showStatusBarItem', true);
    if (!enabled || !v) {
      this.item.hide();
      return;
    }
    const highlight = vscode.workspace.getConfiguration('myStatus').get<boolean>('highlightBusyInStatusBar', true);
    const busy = v.status?.indicatesLimitedAvailability;
    this.item.text = statusText(v.status) || 'Set status';
    this.item.tooltip = userTooltip(v);
    this.item.backgroundColor =
      busy && highlight ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    this.item.show();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
