import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterHeatmap, haversineKm } from '../src/geo.js';
import { parseJSON } from '../src/llm.js';
import { runScout, rankHotspots } from '../src/agent.js';
import { createQloo } from '../src/qloo.js';

const cell = (lat, lon, affinity) => ({ location: { latitude: lat, longitude: lon, geohash: 'x' }, query: { affinity, popularity: 0.5 } });

test('haversine is sane', () => { assert.ok(Math.abs(haversineKm({ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -74 }) - 11.1) < 0.2); });

test('clusters strong neighbouring cells into one hotspot', () => {
  const cs = clusterHeatmap([cell(40.72, -73.95, 1), cell(40.721, -73.951, 0.95), cell(40.80, -73.95, 0.9), cell(40.60, -74.0, 0.2)]);
  assert.equal(cs.length, 2);
  assert.equal(cs[0].cells, 2);
});

test('parseJSON tolerates fences and chatter', () => {
  assert.deepEqual(parseJSON('Sure!\n```json\n{"a":{"b":"}"}}\n```'), { a: { b: '}' } });
  assert.equal(parseJSON('no json here'), null);
});

test('qloo client sends key header, caches, surfaces API errors', async () => {
  let n = 0;
  const fetchImpl = async (url, init) => { n++; assert.equal(init.headers['X-Api-Key'], 'k'); return url.includes('bad') ? new Response(JSON.stringify({ errors: [{ message: 'take must be' }] }), { status: 400 }) : new Response('{"ok":1}'); };
  const q = createQloo({ apiKey: 'k', fetchImpl, perSecond: 100 });
  await q.get('/v2/insights', { a: 1 }); await q.get('/v2/insights', { a: 1 });
  assert.equal(n, 1);
  await assert.rejects(q.get('/bad'), /take must be/);
});

test('agent runs end to end on a fake Qloo and ranks white space first', async () => {
  const fake = {
    search: async name => ({ results: [{ entity_id: `id-${name}`, name, types: ['urn:entity:artist'], properties: {} }] }),
    tags: async () => ({ results: { tags: [{ id: 'urn:tag:category:place:bar', name: 'Bar' }] } }),
    insights: async p => {
      const t = p['filter.type'];
      if (t === 'urn:heatmap') return { results: { heatmap: [cell(40.72, -73.95, 1), cell(40.80, -73.90, 0.98)] } };
      if (t === 'urn:tag') return { results: { tags: [{ tag_id: 'urn:tag:style:qloo:chill', name: 'Chill', subtype: 'urn:tag:style:qloo', query: { affinity: 1 } }] } };
      if (t === 'urn:demographics') return { results: { demographics: [{ query: { age: { '25_to_29': 0.3 }, gender: { male: 0 } } }] } };
      if (t === 'urn:entity:place' && p['filter.tags']) return { results: { entities: p['filter.location'].includes('40.72') ? Array(20).fill({ name: 'Bar X' }) : [{ name: 'Bar Y' }] } };
      if (t === 'urn:entity:place') return { results: { entities: [{ name: 'Anchor', properties: { neighborhood: p['filter.location'].includes('40.72') ? 'Crowdedville' : 'Quietburg' } }] } };
      return { results: { entities: [{ entity_id: 'z', name: 'Rec', properties: {} }] } };
    },
  };
  const events = [];
  const fetchImpl = async () => new Response(JSON.stringify([{ lat: '40.75', lon: '-73.95', boundingbox: ['40.5', '40.9', '-74.2', '-73.7'], display_name: 'New York, USA' }]));
  const r = await runScout({ city: 'New York', concept: 'bar', seeds: ['A', 'B'] }, { qloo: fake, llm: null, fetchImpl, emit: e => events.push(e) });
  assert.equal(r.neighborhoods[0].neighborhood, 'Quietburg');
  assert.equal(r.neighborhoods[0].label, 'white space');
  assert.equal(r.brief.writer, 'deterministic');
  assert.ok(events.some(e => e.name === 'heatmap' && e.status === 'done'));
});

test('ranking: all-zero competition, ties and duplicate neighbourhoods', () => {
  const h = (neighborhood, lat, lon, score, competitor_count, peak = 1, n = 2) => ({ neighborhood, lat, lon, score, competitor_count, peak, anchors: Array(n).fill({ name: 'a' }) });
  const zero = rankHotspots([h('A', 40.7, -74, 0.9, 0), h('B', 40.8, -74, 0.8, 0)]);
  assert.deepEqual(zero.map(r => r.label), ['white space', 'white space']);
  assert.ok(zero[0].note && zero[0].opportunity === 0.935);
  const tie = rankHotspots([h('Busy', 40.7, -74, 0.9, 10, 1), h('Quiet', 40.8, -74, 0.9, 10, 1, 4)]);
  assert.equal(tie[0].opportunity, tie[1].opportunity);
  assert.equal(tie[0].neighborhood, 'Quiet');
  const capped = rankHotspots([h('X', 40.7, -74, 0.9, 50), h('Y', 40.8, -74, 0.9, 50)]);
  assert.ok(capped.every(r => r.label === 'proven but crowded'));
  const dup = rankHotspots([h('Soho', 40.70, -74, 0.9, 5), h('Soho', 40.74, -74, 0.8, 5)]);
  assert.deepEqual(dup.map(r => r.neighborhood).sort(), ['Soho (north)', 'Soho (south)']);
});

import { runTour, scoreCity, orderRoute } from '../src/tour.js';

test('orderRoute finds a shorter path than ranking order', () => {
  const stops = [{ city: 'LA', lat: 34, lon: -118 }, { city: 'Berlin', lat: 52.5, lon: 13.4 }, { city: 'NY', lat: 40.7, lon: -74 }, { city: 'London', lat: 51.5, lon: -0.1 }];
  const o = orderRoute(stops).map(s => s.city);
  assert.ok(o.join() === 'LA,NY,London,Berlin' || o.join() === 'Berlin,London,NY,LA');
});

test('scoreCity is the mean of the best five venue affinities', () => {
  assert.equal(scoreCity([{ affinity: 0.9 }, { affinity: 0.8 }, { affinity: 0 }]).score, 0.85);
  assert.equal(scoreCity([]).score, 0);
});

test('tour router ranks cities by venue affinity and returns a route', async () => {
  const aff = { 'POINT(-87.6298 41.8781)': 0.95, 'POINT(-0.1276 51.5072)': 0.7 };
  const fake = {
    search: async name => ({ results: [{ entity_id: 'a1', name, types: ['urn:entity:artist'], properties: {} }] }),
    insights: async p => {
      if (p['filter.type'] === 'urn:heatmap') { const [lon, lat] = p['filter.location'].match(/-?[\d.]+/g).map(Number); return { results: { heatmap: [cell(lat, lon, 1)] } }; }
      const a = Object.entries(aff).find(([k]) => { const [x, y] = k.match(/-?[\d.]+/g).map(Number); return Math.abs(x - +p['filter.location'].match(/-?[\d.]+/g)[0]) < 0.01; })?.[1] ?? 0.5;
      return { results: { entities: [{ name: `Venue ${a}`, properties: { neighborhood: 'Hood' }, tags: [], query: { affinity: a } }] } };
    },
  };
  const r = await runTour({ artist: 'Mitski', cities: ['London', 'Chicago'], stops: 2 }, { qloo: fake, llm: null });
  assert.equal(r.cities[0].city, 'Chicago');
  assert.equal(r.route.stops.length, 2);
  assert.match(r.note.headline, /Chicago/);
});
