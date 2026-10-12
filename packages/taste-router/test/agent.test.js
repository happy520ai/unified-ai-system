import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTasteAgent, planDomains } from '../src/agent.js';
import { createQlooClient } from '../src/qlooClient.js';
import { createMcpHandler } from '../src/mcp.js';

const fakeQloo = {
  async search(name) { return [{ id: `id-${name}`, name, type: 'urn:entity:artist' }]; },
  async insights({ type, entityIds }) {
    return [{ id: entityIds[0], name: 'seed echo' }, { id: `${type}-1`, name: `${type} pick` }];
  },
};

test('planDomains reads intent', () => {
  assert.deepEqual(planDomains('dinner then a movie'), ['dining', 'movies']);
  assert.deepEqual(planDomains(''), ['music', 'movies', 'dining']);
  assert.deepEqual(planDomains('x', ['books', 'nope']), ['books']);
});

test('recommend resolves seeds, fans out and drops seeds from picks', async () => {
  const agent = createTasteAgent({ qloo: fakeQloo });
  const out = await agent.recommend({ likes: ['Radiohead'], domains: ['movies', 'books'] });
  assert.equal(out.seeds[0].id, 'id-Radiohead');
  assert.equal(out.picks.movies[0].name, 'movie pick');
  assert.ok(out.picks.books.every((p) => p.id !== 'id-Radiohead'));
  assert.match(out.summary, /Radiohead/);
});

test('qloo client sends key and params', async () => {
  let seen;
  const client = createQlooClient({
    apiKey: 'k',
    fetchImpl: async (url, init) => {
      seen = { url: String(url), key: init.headers['X-Api-Key'] };
      return { ok: true, json: async () => ({ results: { entities: [{ entity_id: 'a', name: 'A' }] } }) };
    },
  });
  const r = await client.insights({ type: 'movie', entityIds: ['x', 'y'] });
  assert.equal(seen.key, 'k');
  assert.match(seen.url, /filter\.type=urn%3Aentity%3Amovie/);
  assert.match(seen.url, /signal\.interests\.entities=x%2Cy/);
  assert.equal(r[0].id, 'a');
});

test('mcp handler lists and calls tools', async () => {
  const handle = createMcpHandler(createTasteAgent({ qloo: fakeQloo }));
  const list = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.ok(list.result.tools.some((t) => t.name === 'taste_recommend'));
  const call = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'taste_resolve', arguments: { likes: ['Bjork'] } } });
  assert.match(call.result.content[0].text, /id-Bjork/);
});
