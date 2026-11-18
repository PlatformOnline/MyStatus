import * as vscode from 'vscode';
import type { Relation } from '../github/types';
import type { Store } from '../store';
import { USER_SCHEME } from './userItem';

/** Adds a "B" badge and warning color to users who marked themselves busy. */
export class BusyDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<undefined>();
  readonly onDidChangeFileDecorations = this.emitter.event;
  private readonly disposables: vscode.Disposable[];

  constructor(private readonly store: Store) {
    this.disposables = [
      this.emitter,
      vscode.window.registerFileDecorationProvider(this),
      store.onDidChange(() => this.emitter.fire(undefined)),
    ];
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== USER_SCHEME) {
      return undefined;
    }
    const login = uri.path.slice(1);
    const relation = uri.authority as Relation | 'me';
    const user =
      relation === 'me' ? this.store.viewer : this.store.findUser(relation, login);
    if (!user?.status?.indicatesLimitedAvailability) {
      return undefined;
    }
    return new vscode.FileDecoration('B', 'Busy', new vscode.ThemeColor('list.warningForeground'));
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
