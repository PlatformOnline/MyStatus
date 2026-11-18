import * as assert from 'assert';
import * as vscode from 'vscode';
import { Auth } from '../auth';
import { UnauthorizedError } from '../github/client';
import type { GitHubUser, Relation, Viewer } from '../github/types';
import { Store, type StoreAuth } from '../store';

function user(login: string): GitHubUser {
  return { login, name: null, avatarUrl: '', url: '', bio: null, status: null };
}

function viewer(login: string): Viewer {
  return { ...user(login), followers: { totalCount: 0 }, following: { totalCount: 0 } };
}

/** A promise you resolve or reject from the test. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeAuth implements StoreAuth {
  current: vscode.AuthenticationSession | undefined;
  readonly unauthorized: string[] = [];
  private readonly emitter = new vscode.EventEmitter<vscode.AuthenticationSession | undefined>();
  readonly onDidChangeSession = this.emitter.event;

  signIn(token: string): void {
    this.current = { id: token, accessToken: token, account: { id: token, label: token }, scopes: [] };
    this.emitter.fire(this.current);
  }

  signOut(): void {
    this.current = undefined;
    this.emitter.fire(undefined);
  }

  async handleUnauthorized(token: string): Promise<void> {
    this.unauthorized.push(token);
  }
}

/** Client whose responses the test controls, one pending call per token and method. */
class FakeClients {
  readonly viewer = new Map<string, ReturnType<typeof deferred<Viewer>>>();
  readonly users = new Map<string, ReturnType<typeof deferred<{ users: GitHubUser[]; totalCount: number }>>>();

  factory = (token: string) => ({
    getViewer: () => this.get(this.viewer, token).promise,
    getUsers: (relation: Relation) => this.get(this.users, `${token}:${relation}`).promise,
    setStatus: async () => null,
  });

  private get<T>(map: Map<string, ReturnType<typeof deferred<T>>>, key: string) {
    if (!map.has(key)) {
      map.set(key, deferred<T>());
    }
    return map.get(key)!;
  }

  resolveAll(token: string): void {
    this.get(this.viewer, token).resolve(viewer(token));
    for (const r of ['followers', 'following'] as const) {
      this.get(this.users, `${token}:${r}`).resolve({ users: [user(`${token}-${r}`)], totalCount: 1 });
    }
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

suite('store', () => {
  test('sign-out while loading does not bring the old data back', async () => {
    const auth = new FakeAuth();
    const clients = new FakeClients();
    const store = new Store(auth, clients.factory);

    auth.signIn('alice');
    await tick();
    assert.strictEqual(store.lists.followers.loading, true);

    auth.signOut();
    clients.resolveAll('alice');
    await tick();

    assert.strictEqual(store.viewer, undefined);
    assert.strictEqual(store.lists.followers.users, undefined);
    assert.strictEqual(store.lists.followers.loading, false);
    store.dispose();
  });

  test('switching accounts discards the previous account and loads the new one', async () => {
    const auth = new FakeAuth();
    const clients = new FakeClients();
    const store = new Store(auth, clients.factory);

    auth.signIn('alice');
    await tick();
    auth.signIn('bob');
    await tick();
    // Bob's list requests must start even though Alice's are still pending.
    assert.ok(clients.users.has('bob:followers'));

    clients.resolveAll('bob');
    await tick();
    clients.resolveAll('alice');
    await tick();

    assert.strictEqual(store.viewer?.login, 'bob');
    assert.deepStrictEqual(store.lists.followers.users?.map((u) => u.login), ['bob-followers']);
    assert.strictEqual(store.lists.following.loading, false);
    store.dispose();
  });

  test('401 is reported with the token that was rejected; stale failures are ignored', async () => {
    const auth = new FakeAuth();
    const clients = new FakeClients();
    const store = new Store(auth, clients.factory);

    auth.signIn('alice');
    await tick();
    auth.signIn('bob');
    await tick();

    clients.viewer.get('alice')!.reject(new UnauthorizedError());
    clients.viewer.get('bob')!.reject(new UnauthorizedError());
    await tick();

    assert.deepStrictEqual(auth.unauthorized, ['bob']);
    assert.ok(store.viewerError);
    store.dispose();
  });
});

suite('auth', () => {
  test('handleUnauthorized ignores a token that is not the active session', async () => {
    const auth = new Auth({ get: () => true, update: async () => {}, keys: () => [] } as vscode.Memento);
    let fired = 0;
    auth.onDidChangeSession(() => fired++);
    // No active session: must return without prompting (a prompt would block the test).
    await auth.handleUnauthorized('stale-token');
    assert.strictEqual(fired, 0);
    assert.strictEqual(auth.current, undefined);
    auth.dispose();
  });
});
