import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterHeatmap, haversineKm } from '../src/geo.js';
import { parseJSON } from '../src/llm.js';
import { runScout, rankHotspots, tasteFit, tasteDepth, verdictCard, audienceOverlap } from '../src/agent.js';
import { askReport, chatEvidence } from '../src/ask.js';
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
  assert.ok(zero[0].note && zero[0].fit === 66 && zero[0].fit_parts.space === 1);
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

test('Taste-Fit: weighted parts, local heatmap depth, audience overlap, verdict card', () => {
  assert.equal(tasteFit({ taste: 1, overlap: 1, space: 1 }), 100);
  assert.equal(tasteFit({ taste: 0.5, overlap: 0.5, space: 0 }), 35);
  assert.equal(tasteFit({ taste: 1, overlap: 0, space: 0 }, { taste: 1, overlap: 0, space: 0 }), 100);
  assert.ok(Math.abs(audienceOverlap([{ affinity: 0.9 }, { affinity: 0.8 }, { affinity: 0.7 }, { affinity: 0.1 }]) - 0.8) < 1e-9);
  const cells = [[40.70, -74, 0.9], [40.701, -74, 0.7], [40.702, -74, 0.8], [40.9, -74, 0.1]];
  assert.ok(Math.abs(tasteDepth({ lat: 40.7, lon: -74, score: 1 }, cells) - 0.8) < 1e-9);
  assert.equal(tasteDepth({ lat: 41.5, lon: -74, score: 0.6 }, cells), 0.6); // too few cells nearby -> cluster score
  const ranked = rankHotspots([
    { neighborhood: 'Packed', lat: 40.7, lon: -74, score: 1, peak: 1, competitor_count: 50, anchors: [{ affinity: 0.9 }] },
    { neighborhood: 'Open', lat: 40.8, lon: -74, score: 1, peak: 1, competitor_count: 2, anchors: [{ affinity: 0.9 }] },
  ]);
  assert.equal(ranked[0].neighborhood, 'Open');
  const v = verdictCard(ranked, 300);
  assert.equal(v.neighborhood, 'Open'); assert.equal(v.lead, ranked[0].fit - ranked[1].fit); assert.ok(['Your people are here', 'Worth a visit', 'A harder road'].includes(v.verdict));
});

test('follow-up chat: rescore tool uses 0 Qloo calls and stays grounded in stored evidence', async () => {
  const hood = (n, lat, taste, overlap, space) => ({ neighborhood: n, lat, lon: -74, fit: tasteFit({ taste, overlap, space }), fit_parts: { taste, overlap, space }, competitor_count: 5, anchors: [{ name: `${n} venue`, tags: [], affinity: overlap }], label: 'healthy demand' });
  const report = { result: { plan: { concept: 'bar', city: 'NYC' }, concept: { category: { name: 'Bar' } }, seeds: { resolved: [{ id: 'a', name: 'A' }] }, neighborhoods: [hood('Deep', 40.7, 1, 0.8, 0.1), hood('Empty', 40.8, 0.6, 0.7, 1)], dna: { groups: {} }, programming: {}, brief: {} } };
  const seen = [];
  const llm = { name: 'fake', chat: async msgs => { seen.push(msgs); return seen.length === 1 ? '{"tool":"rescore","weights":{"taste":0,"overlap":0,"space":1}}' : 'Empty leads once competition is all that matters.'; } };
  const qloo = { tags: async () => { throw new Error('no Qloo call expected'); }, insights: async () => { throw new Error('no Qloo call expected'); } };
  const out = await askReport({ report, question: 'I only care about low competition' }, { llm, qloo });
  assert.equal(out.qloo_calls, 0);
  assert.equal(out.tool.rows[0].name, 'Empty'); assert.equal(out.tool.rows[0].after, 100);
  assert.match(seen[1][1].content, /Deep venue/); // the answer step sees the stored evidence
  assert.equal(chatEvidence(report.result).neighborhoods[0].taste_fit, report.result.neighborhoods[0].fit);
});

import { mergeStory, storyIssues, belongLine, fallbackStory } from '../src/agent.js';
import { allowedKit, groundingIssues } from '../src/grounding.js';

const storyEv = () => ({
  city: 'New York', concept: 'vinyl bar', category: { name: 'Wine Bar' }, seeds: [{ name: 'Khruangbin' }],
  taste_dna: { menu: ['Pork Buns'] },
  programming_full: { artists: [{ name: 'Rhye' }], films: [{ name: 'Before Sunrise' }], brands: [{ name: 'Le Labo Fragrances' }], books: [{ name: 'Eating Animals' }] },
  neighborhoods_full: [
    { neighborhood: 'Long Island City', fit: 71, fit_parts: { taste: 0.77, overlap: 0.76, space: 0.58 }, competitor_count: 21, label: 'healthy demand', anchors: [{ name: 'MoMA PS1' }, { name: 'SculptureCenter' }] },
    { neighborhood: 'Bushwick', fit: 63, fit_parts: { taste: 0.87, overlap: 0.75, space: 0.2 }, competitor_count: 40, label: 'proven but crowded', anchors: [{ name: 'House of Yes' }, { name: 'Molasses Books' }] },
    { neighborhood: 'Ridgewood', fit: 70, fit_parts: { taste: 0.6, overlap: 0.7, space: 1 }, competitor_count: 0, label: 'white space', anchors: [] },
  ],
});
const storyKits = [{ loves: 'Khruangbin', listens: { name: 'Rhye' }, watches: { name: 'Before Sunrise' }, wears: { name: 'Le Labo Fragrances' }, reads: { name: 'Eating Animals' }, eats: 'Pork Buns', hangout: { name: 'MoMA PS1', neighborhood: 'Long Island City' }, age: { band: '35–44', lift: 17 } }];

test('grounding: food, drink and brand nouns outside the Qloo kit are caught', () => {
  const A = allowedKit(storyEv(), storyKits);
  assert.deepEqual(groundingIssues('Maya wanders MoMA PS1 with Rhye on, orders pork buns and wears Le Labo.', A, ['Maya']), []);
  const bad = groundingIssues('Maya sips a cold brew from Starbucks before heading to Joe’s Pub with Rhye on.', A, ['Maya']);
  assert.ok(bad.includes('cold brew') && bad.includes('starbucks'));
  assert.ok(bad.some(t => /Joe/.test(t)));
  assert.deepEqual(groundingIssues('Thursday nights, they wait for Before Sunrise.', A, []), []);
});

test('story: invented details are replaced by deterministic Qloo-only copy; belong lines use each hood\'s own evidence', () => {
  const ev = storyEv();
  const raw = {
    regulars: [{ name: 'Maya', portrait: 'Maya starts every morning with a cold brew and a croissant, then drifts to MoMA PS1 with Rhye playing, thinking about Before Sunrise all day long.', quote: 'Do you do oat milk?' }],
    opening_night: 'You open the door. Maya walks in with a cold brew, Rhye plays, pork buns fly out of the kitchen and the room hums with the people you dreamed about for years and years.',
    belong: [{ neighborhood: 'Long Island City', line: 'MoMA PS1 is around the corner and the crowd already shares your taste.' }, { neighborhood: 'Bushwick', line: 'People who love what you love gather here.' }],
    verdict_line: 'Your people are already here.', writer: 'test',
  };
  assert.ok(storyIssues(raw, storyKits, ev).includes('cold brew'));
  const s = mergeStory(raw, storyKits, ev);
  const all = [s.regulars[0].portrait, s.regulars[0].quote, s.opening_night, ...s.belong.map(b => b.line)].join(' ');
  assert.doesNotMatch(all, /cold brew|croissant|oat milk/i);
  assert.equal(s.regulars[0].name, 'Maya');
  assert.match(s.regulars[0].portrait, /Rhye|Before Sunrise|MoMA PS1/);
  assert.deepEqual(storyIssues({ ...s, regulars: s.regulars }, storyKits, ev), []);
  assert.equal(s.belong[0].writer, 'llm');
  assert.equal(s.belong[1].writer, 'deterministic'); // generic line rejected
  assert.match(s.belong[1].line, /House of Yes/); assert.match(s.belong[1].line, /40 wine bars/);
  assert.match(s.belong[2].line, /not a single other wine bar|60th percentile/); // no anchors: built from taste depth + white space
  for (const b of s.belong) assert.doesNotMatch(b.line, /People who love what you love already gather here/);
  assert.equal(s.belong[1].facts.competitors, 40);
});

test('belongLine never returns generic copy and fallback story only names kit items', () => {
  const ev = storyEv();
  const lines = ev.neighborhoods_full.map(h => belongLine({ name: h.neighborhood, fit: h.fit, parts: h.fit_parts, competitors: h.competitor_count, label: h.label, anchors: h.anchors.map(a => a.name) }, { city: 'New York', category: 'Wine Bar' }));
  assert.equal(new Set(lines).size, 3);
  lines.forEach(l => assert.match(l, /Taste-Fit \d+\/100/));
  const fb = fallbackStory(ev, storyKits);
  assert.deepEqual(storyIssues(fb, storyKits, ev), []);
});

import { dishName, regularKits } from '../src/agent.js';
import { roleIssues } from '../src/grounding.js';

test('roles: brands are not places, dishes are not sipped, no invented activities; dish names read naturally', () => {
  const A = allowedKit(storyEv(), storyKits);
  const k = [{ ...storyKits[0], wears: { name: 'Outside Voices' }, eats: 'aguachile' }];
  assert.ok(roleIssues('After a trek, they unwind at Outside Voices.', k, A).some(x => /brand as a place/.test(x)));
  assert.ok(roleIssues('They sip aguachile on the stoop.', k, A).some(x => /dish sipped/.test(x)));
  assert.ok(roleIssues('Saturday mornings hiking the lakefront.', k, A).includes('hiking'));
  assert.deepEqual(roleIssues('They wear Outside Voices and order aguachile at MoMA PS1.', k, A), []);
  assert.equal(dishName('Fish Chips'), 'fish and chips');
  assert.equal(dishName('French Fries'), 'fries');
  const kits = regularKits({ seeds: [{ name: 'X' }], taste_dna: { menu: ['French Fries', 'Fries', 'Fish Chips'] }, programming_full: {}, audience: {} });
  assert.deepEqual(kits.map(x => x.eats), ['fries', 'fish and chips', 'fries']);
});
