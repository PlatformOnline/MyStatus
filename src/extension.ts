import * as vscode from 'vscode';
import { Auth } from './auth';
import { clearStatusCommand, setStatusCommand } from './commands/setStatus';
import { StatusHistory } from './history';
import { Store } from './store';
import { BusyDecorationProvider } from './views/decorations';
import { MyStatusProvider } from './views/myStatusProvider';
import { StatusBar } from './views/statusBar';
import type { UserItem } from './views/userItem';
import { UserTreeProvider } from './views/userTreeProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const auth = new Auth(context.globalState);
  const store = new Store(auth);
  const history = new StatusHistory(context.globalState);
  const me = new MyStatusProvider(store);
  const followers = new UserTreeProvider('followers', store);
  const following = new UserTreeProvider('following', store);

  context.subscriptions.push(
    auth,
    store,
    me,
    followers,
    following,
    new BusyDecorationProvider(store),
    new StatusBar(store),

    vscode.commands.registerCommand('mystatus.signIn', async () => {
      try {
        await auth.signIn();
      } catch (e) {
        void vscode.window.showErrorMessage(`GitHub sign-in failed: ${e instanceof Error ? e.message : e}`);
      }
    }),
    vscode.commands.registerCommand('mystatus.signOut', async () => {
      await auth.signOut();
      void vscode.window.showInformationMessage(
        'MyStatus signed out. To revoke access completely, use the Accounts menu in VS Code.',
      );
    }),
    vscode.commands.registerCommand('mystatus.refresh', () => store.refreshAll()),
    vscode.commands.registerCommand('mystatus.setStatus', async () => {
      if (!auth.current) {
        await vscode.commands.executeCommand('mystatus.signIn');
        if (!auth.current) {
          return;
        }
      }
      await setStatusCommand(store, history);
    }),
    vscode.commands.registerCommand('mystatus.clearStatus', () => clearStatusCommand(store, history)),
    vscode.commands.registerCommand('mystatus.clearHistory', async () => {
      const login = store.viewer?.login;
      if (!login) {
        return;
      }
      const ok = await vscode.window.showWarningMessage(
        `Remove all recent statuses for ${login}?`,
        { modal: true },
        'Clear History',
      );
      if (ok) {
        await history.clear(login);
      }
    }),
    vscode.commands.registerCommand('mystatus.openProfile', (item?: UserItem) => {
      if (item) {
        void vscode.env.openExternal(vscode.Uri.parse(item.user.url));
      }
    }),
    vscode.commands.registerCommand('mystatus.copyLogin', async (item?: UserItem) => {
      if (item) {
        await vscode.env.clipboard.writeText(item.user.login);
        void vscode.window.setStatusBarMessage(`Copied ${item.user.login}`, 2000);
      }
    }),
  );

  // Auto refresh: full refresh while a list is visible, otherwise only our own status.
  const timer = new AutoRefresh(store, [followers.view, following.view, me.view]);
  context.subscriptions.push(timer);

  await auth.restore();
}

export function deactivate(): void {}

class AutoRefresh implements vscode.Disposable {
  private handle: ReturnType<typeof setInterval> | undefined;
  private readonly sub: vscode.Disposable;

  constructor(
    private readonly store: Store,
    private readonly views: vscode.TreeView<unknown>[],
  ) {
    this.sub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('myStatus.refreshInterval')) {
        this.schedule();
      }
    });
    this.schedule();
  }

  private schedule(): void {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = undefined;
    }
    const minutes = vscode.workspace.getConfiguration('myStatus').get<number>('refreshInterval', 5);
    if (minutes > 0) {
      this.handle = setInterval(() => this.tick(), Math.max(1, minutes) * 60_000);
    }
  }

  private tick(): void {
    if (!vscode.window.state.focused) {
      return;
    }
    if (this.views.some((v) => v.visible)) {
      void this.store.refreshAll();
    } else {
      void this.store.refreshViewer();
    }
  }

  dispose(): void {
    if (this.handle) {
      clearInterval(this.handle);
    }
    this.sub.dispose();
  }
}
