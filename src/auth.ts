import * as vscode from 'vscode';

const PROVIDER_ID = 'github';
/** `user` is required for changeUserStatus; it also covers read:user and user:follow. */
const SCOPES = ['user'];
const SIGNED_OUT_KEY = 'mystatus.signedOut';

/**
 * Wraps VS Code's built-in GitHub authentication provider.
 *
 * Extensions cannot remove a session from the built-in provider, so "sign out"
 * means: forget the session here and stop picking it up silently until the
 * user explicitly signs in again.
 */
export class Auth implements vscode.Disposable {
  private session: vscode.AuthenticationSession | undefined;
  private readonly emitter = new vscode.EventEmitter<vscode.AuthenticationSession | undefined>();
  private readonly disposables: vscode.Disposable[] = [];

  /** Fires whenever the active session changes (undefined = signed out). */
  readonly onDidChangeSession = this.emitter.event;

  constructor(private readonly state: vscode.Memento) {
    this.disposables.push(
      this.emitter,
      vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id === PROVIDER_ID) {
          await this.restore();
        }
      }),
    );
  }

  get current(): vscode.AuthenticationSession | undefined {
    return this.session;
  }

  /** Picks up an existing session without prompting the user. */
  async restore(): Promise<void> {
    if (this.state.get<boolean>(SIGNED_OUT_KEY)) {
      this.set(undefined);
      return;
    }
    try {
      const s = await vscode.authentication.getSession(PROVIDER_ID, SCOPES, { silent: true });
      this.set(s);
    } catch {
      this.set(undefined);
    }
  }

  async signIn(): Promise<void> {
    const s = await vscode.authentication.getSession(PROVIDER_ID, SCOPES, { createIfNone: true });
    await this.state.update(SIGNED_OUT_KEY, false);
    this.set(s);
  }

  async signOut(): Promise<void> {
    await this.state.update(SIGNED_OUT_KEY, true);
    this.set(undefined);
  }

  /**
   * Called when the API rejects `token`, e.g. after it was revoked on github.com.
   * Several parallel requests can fail with the same token; only the first one
   * that still matches the active session signs out and prompts.
   */
  async handleUnauthorized(token: string): Promise<void> {
    if (!this.session || this.session.accessToken !== token) {
      return;
    }
    this.set(undefined);
    const choice = await vscode.window.showWarningMessage(
      'MyStatus: your GitHub session is no longer valid.',
      'Sign in again',
    );
    if (!choice) {
      return;
    }
    try {
      const s = await vscode.authentication.getSession(PROVIDER_ID, SCOPES, { forceNewSession: true });
      this.set(s);
    } catch (e) {
      // The user cancelled the sign-in flow, or it failed.
      void vscode.window.showErrorMessage(`GitHub sign-in failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  private set(s: vscode.AuthenticationSession | undefined): void {
    if (s?.accessToken === this.session?.accessToken && s?.id === this.session?.id) {
      return;
    }
    this.session = s;
    void vscode.commands.executeCommand('setContext', 'mystatus.signedIn', !!s);
    this.emitter.fire(s);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
