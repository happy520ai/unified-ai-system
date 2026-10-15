// Tour Router: given an artist (or any taste seeds) and a list of candidate cities, rank the cities by how
// strongly Qloo's heatmap says that taste concentrates there, then order the best stops into the shortest route.
import { makeTools } from './tools.js';
import { geocodeCity } from './geocode.js';
import { haversineKm } from './geo.js';
import { parseJSON } from './llm.js';

// Built-in city table (centre + search radius in metres) so a tour needs no geocoding calls.
export const CITIES = {
  'New York': [40.7128, -74.006, 14000], 'Los Angeles': [34.0522, -118.2437, 16000], 'Chicago': [41.8781, -87.6298, 14000],
  'San Francisco': [37.7749, -122.4194, 9000], 'Austin': [30.2672, -97.7431, 12000], 'Seattle': [47.6062, -122.3321, 11000],
  'Toronto': [43.6532, -79.3832, 13000], 'Boston': [42.3601, -71.0589, 10000], 'Philadelphia': [39.9526, -75.1652, 11000],
  'Atlanta': [33.749, -84.388, 12000], 'Nashville': [36.1627, -86.7816, 11000], 'Denver': [39.7392, -104.9903, 11000],
  'London': [51.5072, -0.1276, 14000], 'Paris': [48.8566, 2.3522, 10000], 'Berlin': [52.52, 13.405, 13000],
  'Amsterdam': [52.3676, 4.9041, 8000], 'Manchester': [53.4808, -2.2426, 9000], 'Madrid': [40.4168, -3.7038, 11000],
  'Barcelona': [41.3874, 2.1686, 9000], 'Melbourne': [-37.8136, 144.9631, 13000], 'Sydney': [-33.8688, 151.2093, 13000], 'Tokyo': [35.6762, 139.6503, 16000],
};
export const DEFAULT_CITIES = ['New York', 'Los Angeles', 'Chicago', 'London', 'Berlin', 'Toronto'];

const key = s => String(s).toLowerCase().trim();
async function locate(city, opts) {
  const hit = Object.keys(CITIES).find(c => key(c) === key(city));
  if (hit) { const [lat, lon, radius_m] = CITIES[hit]; return { name: hit, lat, lon, radius_m }; }
  const g = await geocodeCity(city, opts);
  return g ? { ...g, name: city } : null;
}

/**
 * City score = mean Qloo affinity of the five most taste-matched venues around the city's hottest cluster.
 * (Heatmap affinity is rank-normalised inside each city, so it finds WHERE in a city but cannot compare cities;
 * venue affinity is an absolute audience-overlap score, so it can.)
 */
export function scoreCity(anchors) {
  const top = (anchors || []).map(a => a.affinity).filter(x => x > 0).sort((x, y) => y - x).slice(0, 5);
  if (!top.length) return { score: 0, peak: 0 };
  return { score: +(top.reduce((t, x) => t + x, 0) / top.length).toFixed(3), peak: +top[0].toFixed(3) };
}

const routeKm = stops => stops.slice(1).reduce((t, s, i) => t + haversineKm(stops[i], s), 0);
/** Shortest open path through the stops (brute force; tours have <= 8 stops). */
export function orderRoute(stops) {
  if (stops.length < 3) return stops.slice();
  let best = null, bestKm = Infinity;
  const permute = (rest, path) => {
    if (!rest.length) { const km = routeKm(path); if (km < bestKm) { bestKm = km; best = path; } return; }
    rest.forEach((s, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...path, s]));
  };
  permute(stops, []);
  return best;
}

const TOUR_PROMPT = `You are TasteRouter's tour planner. Using ONLY the Qloo evidence provided, write a short routing note for an artist's team.
Return ONLY JSON: {"headline":"max 16 words: the strongest market and why it leads","why":["2-3 short evidence-backed reasons the top cities lead"],"routing_tip":"one short sentence about the order of the stops","risks":["1-2 honest risks"],"fan_night":"60-90 words, second person, present tense, warm: an intimate fan night in the strongest city's hottest neighbourhood, at the suggested room, with the suggested local opener. Who is in the crowd, how it feels. Only names from the evidence."}
Write for an artist's team who care about their fans as people, warm but concrete. Taste-fit scores are out of 100 (mean audience-overlap of the best venues in each city). Never invent venues or numbers.`;

export async function runTour(input, { qloo, llm, store, emit = () => {}, fetchImpl = fetch, storyModel } = {}) {
  const tools = makeTools(qloo);
  const t0 = Date.now();
  const step = async (name, label, fn) => {
    const s = Date.now(); emit({ type: 'step', name, status: 'start', label });
    try { const out = await fn(); emit({ type: 'step', name, status: 'done', label, ms: Date.now() - s, summary: out.__summary }); return out; }
    catch (e) { emit({ type: 'step', name, status: 'error', label, ms: Date.now() - s, error: String(e.message || e) }); throw e; }
  };
  const stopsWanted = Math.min(5, Math.max(2, +input.stops || 4));
  const names = [...new Set((input.cities?.length ? input.cities : DEFAULT_CITIES).map(c => String(c).trim()).filter(Boolean))].slice(0, 8);
  const seedsIn = (input.seeds?.length ? input.seeds : input.artist ? [input.artist] : []).map(s => (typeof s === 'string' ? { name: s, type: 'artist' } : s));
  if (!seedsIn.length) throw new Error('Send {artist} or {seeds[]}.');

  const seeds = await step('resolve', 'Grounding the artist in Qloo', async () => {
    const r = await tools.resolve_seeds({ seeds: seedsIn });
    if (!r.resolved.length) throw new Error(`Qloo has no entity for ${seedsIn.map(s => s.name).join(', ')}.`);
    return Object.assign(r, { __summary: r.resolved.map(s => s.name).join(', ') });
  });
  const ids = seeds.resolved.map(s => s.id);

  const cities = await step('markets', `Reading the Qloo heatmap and venue affinity in ${names.length} candidate cities`, async () => {
    const rows = await Promise.all(names.map(async name => {
      try {
        const c = await locate(name, { fetchImpl, store });
        if (!c) return null;
        const h = await tools.hotspots({ entity_ids: ids, city: name, center: c, max: 2 });
        const top = h.hotspots[0];
        if (!top) return null;
        const s = await tools.scout_hotspot({ lat: top.lat, lon: top.lon, entity_ids: ids });
        return { city: c.name, lat: c.lat, lon: c.lon, hot: { lat: top.lat, lon: top.lon }, cell_count: h.cell_count, neighborhood: s.neighborhood, anchors: s.anchors, ...scoreCity(s.anchors) };
      } catch { return null; }
    }));
    const ok = rows.filter(Boolean).sort((a, b) => (b.score - a.score) || (b.peak - a.peak));
    if (!ok.length) throw new Error('No city returned usable Qloo data.');
    return Object.assign(ok, { __summary: ok.map(c => `${c.city} ${Math.round(c.score * 100)}`).join(' · ') });
  });
  const picked = cities.slice(0, stopsWanted);

  const route = await step('route', 'Ordering the stops into the shortest route', async () => {
    const stops = orderRoute(picked.map(c => ({ lat: c.lat, lon: c.lon, city: c.city })));
    const byRank = picked.map(c => ({ lat: c.lat, lon: c.lon }));
    const km = Math.round(routeKm(stops)), rankKm = Math.round(routeKm(byRank));
    return { order: stops.map(s => s.city), km, rank_order_km: rankKm, __summary: `${stops.map(s => s.city).join(' → ')} · ${km.toLocaleString('en-US')} km (vs ${rankKm.toLocaleString('en-US')} km in ranking order)` };
  });

  // FAN NIGHT — an intimate show in the strongest market: a taste-matched room near the fans + a local-leaning opener.
  const night = await step('fan_night', `Planning an intimate fan night in ${cities[0].city}`, async () => {
    const top = cities[0];
    const room = (top.anchors || []).find(a => /music|bar|club|venue|theat|lounge|jazz|record/i.test([a.name, ...(a.tags || [])].join(' '))) || top.anchors?.[0] || null;
    const r = await qloo.insights({ 'filter.type': 'urn:entity:artist', 'signal.interests.entities': ids, 'signal.location.query': top.city, take: 8 }).catch(() => null);
    const own = new Set(ids);
    const openers = (r?.results?.entities || []).filter(e => !own.has(e.entity_id)).slice(0, 3).map(e => ({ name: e.name, image: e.properties?.image?.url }));
    return { city: top.city, neighborhood: top.neighborhood, room: room && { name: room.name, tags: room.tags, image: room.image, affinity: room.affinity }, openers, __summary: `${room?.name || top.neighborhood || top.city}${openers[0] ? ` · opener ${openers[0].name}` : ''}` };
  });
  delete night.__summary;

  const evidence = { fan_night_plan: { city: night.city, neighborhood: night.neighborhood, room: night.room?.name, local_openers: night.openers.map(o => o.name) }, artist: seeds.resolved.map(s => s.name), ranked_markets: cities.map(c => ({ city: c.city, taste_fit: Math.round(c.score * 100), taste_peak: Math.round(c.peak * 100), hot_neighborhood: c.neighborhood, venues: (c.anchors || []).slice(0, 3).map(a => a.name) })), route: route.order, route_km: route.km, ranking_order_km: route.rank_order_km };
  const note = await step('write', 'Writing the routing note from Qloo evidence', async () => {
    if (llm) {
      try { const b = parseJSON(await llm.chat([{ role: 'system', content: TOUR_PROMPT }, { role: 'user', content: JSON.stringify(evidence) }], { maxTokens: 700, temperature: 0.6, ...(storyModel ? { model: storyModel } : {}) })); if (b?.headline) return { ...b, writer: llm.name, __summary: b.headline }; }
      catch (e) { emit({ type: 'note', text: `LLM writer unavailable (${e.message}); using deterministic note.` }); }
    }
    const f = fallbackTourNote(evidence); return { ...f, __summary: f.headline };
  });
  delete note.__summary;

  const result = {
    seeds, cities: cities.map(c => ({ ...c, anchors: c.anchors.slice(0, 5) })),
    route: { ...route, stops: route.order.map(n => { const c = cities.find(x => x.city === n); return { city: n, lat: c.lat, lon: c.lon, rank: cities.indexOf(c) + 1 }; }) },
    note, fan_night: night, meta: { ms: Date.now() - t0, llm: llm?.name || null, generated_at: new Date().toISOString() },
  };
  emit({ type: 'result', result });
  return result;
}

export function fallbackTourNote(ev) {
  const top = ev.ranked_markets[0];
  return {
    headline: `${top.city} is ${ev.artist[0]}'s strongest market (${top.taste_fit}/100); route ${ev.route.join(' → ')}.`,
    why: ev.ranked_markets.slice(0, 3).map(m => `${m.city}: taste fit ${m.taste_fit}/100, taste peak ${m.taste_peak}${m.hot_neighborhood ? `, hottest around ${m.hot_neighborhood}` : ''}`),
    routing_tip: `Playing the stops in this order covers about ${ev.route_km.toLocaleString('en-US')} km, versus ${ev.ranking_order_km.toLocaleString('en-US')} km if you went strictly by rank.`,
    risks: ['Taste fit measures audience overlap, not ticket demand: confirm with presale data.'],
    fan_night: ev.fan_night_plan ? `Picture ${ev.fan_night_plan.room || 'a small room'}${ev.fan_night_plan.neighborhood ? ` in ${ev.fan_night_plan.neighborhood}` : ''}, ${ev.fan_night_plan.city}. ${ev.fan_night_plan.local_openers[0] ? `${ev.fan_night_plan.local_openers[0]} opens; ` : ''}the room is full of people who already know every word, because this is where they live.` : '',
    writer: 'deterministic',
  };
}
