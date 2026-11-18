import * as assert from 'assert';
import { StatusHistory } from '../history';

class FakeState {
  private data = new Map<string, unknown>();
  keys() {
    return [...this.data.keys()];
  }
  get<T>(key: string, def?: T): T {
    return (this.data.has(key) ? this.data.get(key) : def) as T;
  }
  async update(key: string, value: unknown) {
    this.data.set(key, value);
  }
  setKeysForSync() {}
}

suite('history', () => {
  test('newest first, deduplicates by emoji+message, per account', async () => {
    const h = new StatusHistory(new FakeState());
    await h.add('alice', { emoji: ':dart:', message: 'Focusing', busy: true, expiry: '4h' });
    await h.add('alice', { emoji: ':computer:', message: 'Coding', busy: false, expiry: 'never' });
    await h.add('alice', { emoji: ':dart:', message: 'Focusing', busy: false, expiry: '1h' });
    await h.add('bob', { emoji: ':palm_tree:', message: 'Vacation', busy: true, expiry: 'week' });

    const list = h.list('alice');
    assert.deepStrictEqual(
      list.map((e) => [e.message, e.busy, e.expiry]),
      [
        ['Focusing', false, '1h'],
        ['Coding', false, 'never'],
      ],
    );
    assert.strictEqual(h.list('bob').length, 1);
  });

  test('remove and clear', async () => {
    const h = new StatusHistory(new FakeState());
    await h.add('alice', { emoji: ':dart:', message: 'A', busy: false, expiry: 'never' });
    await h.add('alice', { emoji: ':dart:', message: 'B', busy: false, expiry: 'never' });
    await h.remove('alice', h.list('alice')[0]);
    assert.deepStrictEqual(h.list('alice').map((e) => e.message), ['A']);
    await h.clear('alice');
    assert.strictEqual(h.list('alice').length, 0);
  });

  test('ignores empty statuses', async () => {
    const h = new StatusHistory(new FakeState());
    await h.add('alice', { busy: false, expiry: 'never' });
    assert.strictEqual(h.list('alice').length, 0);
  });
});
