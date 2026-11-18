import * as assert from 'assert';
import { GitHubClient, MAX_USERS } from '../github/client';

/** Fake GraphQL endpoint serving `total` followers, recording each request's `first`. */
function fakeFetch(total: number, seen: number[]): typeof fetch {
  return (async (_url: unknown, init?: { body?: string }) => {
    const { variables } = JSON.parse(init!.body!);
    const start = variables.after ? Number(variables.after) : 0;
    const count = Math.min(variables.first, total - start);
    seen.push(variables.first);
    const nodes = Array.from({ length: count }, (_, i) => ({ login: `u${start + i}` }));
    const end = start + count;
    return new Response(
      JSON.stringify({
        data: {
          viewer: {
            connection: {
              totalCount: total,
              pageInfo: { hasNextPage: end < total, endCursor: String(end) },
              nodes,
            },
          },
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
}

suite('client.getUsers', () => {
  test('stops at the limit, asks only for what is needed, reports real total', async () => {
    const seen: number[] = [];
    const r = await new GitHubClient('t', fakeFetch(1000, seen)).getUsers('followers', 250);
    assert.strictEqual(r.users.length, 250);
    assert.strictEqual(r.totalCount, 1000);
    assert.deepStrictEqual(seen, [100, 100, 50]);
  });

  test('loads everything when total is below the limit', async () => {
    const seen: number[] = [];
    const r = await new GitHubClient('t', fakeFetch(42, seen)).getUsers('following', 5000);
    assert.strictEqual(r.users.length, 42);
    assert.strictEqual(r.totalCount, 42);
    assert.deepStrictEqual(seen, [100]);
  });

  test('caps limit at MAX_USERS', async () => {
    const seen: number[] = [];
    const r = await new GitHubClient('t', fakeFetch(9000, seen)).getUsers('followers', 99999);
    assert.strictEqual(r.users.length, MAX_USERS);
    assert.strictEqual(r.totalCount, 9000);
  });
});
