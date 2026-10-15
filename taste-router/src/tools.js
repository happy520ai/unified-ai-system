// Qloo-backed tools the TasteRouter agent can call. Each returns plain JSON plus an `evidence` list
// (which Qloo call produced which fact) so the final brief can cite its sources.
import { clusterHeatmap } from './geo.js';

const NOISY_TAG_PREFIXES = ['urn:tag:credit_card', 'urn:tag:inclusivity', 'urn:tag:amenity', 'urn:tag:accessibility', 'urn:tag:offerings', 'urn:tag:payments', 'urn:tag:service_options', 'urn:tag:children', 'urn:tag:parking', 'urn:tag:planning', 'urn:tag:crowd', 'urn:tag:highlights', 'urn:tag:popular_with', 'urn:tag:atmosphere:place:casual'];
const TYPE_ALIASES = { artist: 'urn:entity:artist', band: 'urn:entity:artist', musician: 'urn:entity:artist', movie: 'urn:entity:movie', film: 'urn:entity:movie', tv: 'urn:entity:tv_show', show: 'urn:entity:tv_show', book: 'urn:entity:book', author: 'urn:entity:person', brand: 'urn:entity:brand', place: 'urn:entity:place', restaurant: 'urn:entity:place', game: 'urn:entity:videogame', person: 'urn:entity:person', podcast: 'urn:entity:podcast', destination: 'urn:entity:destination' };

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// Guard against fuzzy-search drift ("Wong Kar-wai" -> an unrelated film): require real name overlap.
export function nameMatches(query, name) {
  const q = norm(query), n = norm(name);
  if (!q || !n) return false;
  if (n.includes(q) || q.includes(n)) return true;
  const qt = q.split(' '), nt = new Set(n.split(' '));
  return qt.filter(t => nt.has(t)).length / qt.length >= 0.5;
}

const slimEntity = e => ({ id: e.entity_id, name: e.name, type: (e.types || [e.subtype])[0], image: e.properties?.image?.url, blurb: e.properties?.short_description || e.properties?.description, popularity: e.popularity, affinity: e.query?.affinity });

export function makeTools(qloo) {
  return {
    /** Free text -> canonical Qloo entities. */
    async resolve_seeds({ seeds }) {
      const out = await Promise.all(seeds.map(async s => {
        const types = s.type ? TYPE_ALIASES[String(s.type).toLowerCase()] : undefined;
        let r = await qloo.search(s.name, { types, take: 3 }).catch(() => null);
        if (!r?.results?.length && types) r = await qloo.search(s.name, { take: 3 }).catch(() => null);
        let pool = (r?.results || []).filter(x => nameMatches(s.name, x.name));
        if (!pool.length && types) { const r2 = await qloo.search(s.name, { take: 5 }).catch(() => null); pool = (r2?.results || []).filter(x => nameMatches(s.name, x.name)); }
        const banned = ['urn:entity:locality', 'urn:entity:destination', 'urn:entity:place'];
        pool = pool.filter(x => types === 'urn:entity:place' || !banned.includes(x.types?.[0]));
        const hit = pool.find(x => !String(x.types?.[0]).includes('person')) || pool[0];
        return hit ? { query: s.name, ...slimEntity({ ...hit, properties: hit.properties || {} }), image: hit.properties?.image?.url, blurb: hit.properties?.short_description } : { query: s.name, missing: true };
      }));
      return { resolved: out.filter(x => !x.missing), missing: out.filter(x => x.missing).map(x => x.query) };
    },

    /** Map the business concept to a Qloo place-category tag (for supply / competition) and vibe tags. */
    async concept_tags({ terms }) {
      const all = (await Promise.all(terms.map(t => qloo.tags(t, { take: 10 }).catch(() => null))))
        .flatMap(r => r?.results?.tags || []);
      const category = all.find(t => t.id?.startsWith('urn:tag:category:place:')) || all.find(t => t.id?.startsWith('urn:tag:genre:place:'));
      const vibes = [...new Map(all.filter(t => t !== category && /:(qloo|place):/.test(t.id || '')).map(t => [t.id, { id: t.id, name: t.name }])).values()].slice(0, 6);
      return { category: category ? { id: category.id, name: category.name } : null, vibes };
    },

    /** The shared taste fingerprint of the seeds: the tags their fans over-index on. */
    async taste_dna({ entity_ids }) {
      const r = await qloo.insights({ 'filter.type': 'urn:tag', 'signal.interests.entities': entity_ids, take: 50 });
      const tags = (r.results?.tags || [])
        .filter(t => !NOISY_TAG_PREFIXES.some(p => t.tag_id?.startsWith(p)))
        .map(t => ({ id: t.tag_id, name: t.name, kind: (t.subtype || '').split(':')[2] || 'other', affinity: +(t.query?.affinity ?? 0).toFixed(3) }));
      const bucket = k => /specialty_dish|menu|cuisine|dish|drink/.test(k) ? 'menu' : /cost|price|rating/.test(k) ? 'price' : /genre|category/.test(k) ? 'format' : 'vibe';
      const groups = { vibe: [], menu: [], format: [], price: [] };
      for (const t of tags) { const b = bucket(t.kind); if (groups[b].length < 6) groups[b].push(t); }
      return { groups, tags: tags.slice(0, 20) };
    },

    /** Who the audience is (age / gender skew vs. baseline). */
    async audience({ entity_ids }) {
      const r = await qloo.insights({ 'filter.type': 'urn:demographics', 'signal.interests.entities': entity_ids });
      const rows = r.results?.demographics || [];
      const avg = {};
      for (const row of rows) for (const [dim, vals] of Object.entries(row.query || {})) for (const [k, v] of Object.entries(vals)) {
        avg[dim] ??= {}; avg[dim][k] = (avg[dim][k] || 0) + v / rows.length;
      }
      for (const dim of Object.keys(avg)) for (const k of Object.keys(avg[dim])) avg[dim][k] = +avg[dim][k].toFixed(2);
      const topAge = Object.entries(avg.age || {}).sort((a, b) => b[1] - a[1])[0];
      return { skew: avg, top_age: topAge?.[0], top_age_lift: topAge?.[1] };
    },

    /** Where in the city the taste concentrates: Qloo heatmap -> clustered hotspots. */
    async hotspots({ entity_ids, city, tag_ids, max = 4, center }) {
      // A city-name query returns a coarse, region-wide grid; a point + radius returns street-level cells.
      const where = center ? { 'filter.location': `POINT(${center.lon.toFixed(4)} ${center.lat.toFixed(4)})`, 'filter.location.radius': center.radius_m } : { 'filter.location.query': city };
      const r = await qloo.insights({ 'filter.type': 'urn:heatmap', ...where, 'signal.interests.entities': entity_ids, 'signal.interests.tags': tag_ids?.length ? tag_ids : undefined });
      const cells = r.results?.heatmap || [];
      return { city, cell_count: cells.length, hotspots: clusterHeatmap(cells, { maxClusters: max }), cells: cells.slice(0, 400).map(c => [c.location.latitude, c.location.longitude, +(c.query?.affinity ?? 0).toFixed(3)]) };
    },

    /** Ground-truth a hotspot: what neighbourhood it is, taste-matched anchor venues, and how crowded the category is. */
    async scout_hotspot({ lat, lon, entity_ids, category_tag, radius_m = 900 }) {
      const point = `POINT(${lon.toFixed(5)} ${lat.toFixed(5)})`;
      const [anchors, supply] = await Promise.all([
        qloo.insights({ 'filter.type': 'urn:entity:place', 'filter.location': point, 'filter.location.radius': radius_m, 'signal.interests.entities': entity_ids, take: 8 }).catch(() => null),
        category_tag ? qloo.insights({ 'filter.type': 'urn:entity:place', 'filter.location': point, 'filter.location.radius': radius_m, 'filter.tags': category_tag, take: 50 }).catch(() => null) : null,
      ]);
      const places = (anchors?.results?.entities || []).map(e => ({ name: e.name, neighborhood: e.properties?.neighborhood, address: e.properties?.address, tags: (e.tags || []).filter(t => !NOISY_TAG_PREFIXES.some(p => t.id?.startsWith(p))).map(t => t.name).filter((n, i, a) => a.indexOf(n) === i).slice(0, 3), affinity: +(e.query?.affinity ?? 0).toFixed(3), image: e.properties?.images?.[0]?.url }));
      const counts = {};
      for (const p of places) if (p.neighborhood) counts[p.neighborhood] = (counts[p.neighborhood] || 0) + 1;
      const townOf = a => { const m = /([A-Za-z .'-]+?),?\s+[A-Z]{2}\s+\d{5}/.exec(a || ''); return m ? m[1].trim().split(/\s+/).slice(-2).join(' ') : null; };
      const neighborhood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || townOf(places[0]?.address) || null;
      const competitors = (supply?.results?.entities || []).map(e => e.name);
      return { neighborhood, anchors: places.slice(0, 5), competitor_count: category_tag ? competitors.length : null, competitors: competitors.slice(0, 6) };
    },

    /** Cross-domain programming: what to play, screen, stock and who to collab with. */
    async programming({ entity_ids, city }) {
      const kinds = { artists: 'urn:entity:artist', films: 'urn:entity:movie', brands: 'urn:entity:brand', books: 'urn:entity:book' };
      const seedSet = new Set(entity_ids);
      const entries = await Promise.all(Object.entries(kinds).map(async ([k, type]) => {
        const r = await qloo.insights({ 'filter.type': type, 'signal.interests.entities': entity_ids, take: 8 }).catch(() => null);
        return [k, (r?.results?.entities || []).filter(e => !seedSet.has(e.entity_id)).slice(0, 5).map(slimEntity)];
      }));
      const out = Object.fromEntries(entries);
      if (city) {
        const local = await qloo.insights({ 'filter.type': 'urn:entity:artist', 'signal.interests.entities': entity_ids, 'signal.location.query': city, take: 8 }).catch(() => null);
        out.local_lean_artists = (local?.results?.entities || []).filter(e => !seedSet.has(e.entity_id)).slice(0, 5).map(slimEntity);
      }
      return out;
    },
  };
}

export const TOOL_SPECS = [
  { name: 'resolve_seeds', description: 'Resolve free-text taste references (artists, films, brands, places, books) into Qloo entities.', parameters: { type: 'object', properties: { seeds: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' } }, required: ['name'] } } }, required: ['seeds'] } },
  { name: 'concept_tags', description: 'Map business-concept words (e.g. "wine bar", "listening bar") to Qloo place category and vibe tags.', parameters: { type: 'object', properties: { terms: { type: 'array', items: { type: 'string' } } }, required: ['terms'] } },
  { name: 'taste_dna', description: 'Tags the fans of these entities over-index on.', parameters: { type: 'object', properties: { entity_ids: { type: 'array', items: { type: 'string' } } }, required: ['entity_ids'] } },
  { name: 'audience', description: 'Age/gender skew of the audience for these entities.', parameters: { type: 'object', properties: { entity_ids: { type: 'array', items: { type: 'string' } } }, required: ['entity_ids'] } },
  { name: 'hotspots', description: 'Where in a city the taste concentrates (Qloo heatmap, clustered).', parameters: { type: 'object', properties: { entity_ids: { type: 'array', items: { type: 'string' } }, city: { type: 'string' }, tag_ids: { type: 'array', items: { type: 'string' } } }, required: ['entity_ids', 'city'] } },
  { name: 'scout_hotspot', description: 'Neighbourhood name, taste-matched anchor venues and category competition around a point.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, entity_ids: { type: 'array', items: { type: 'string' } }, category_tag: { type: 'string' } }, required: ['lat', 'lon', 'entity_ids'] } },
  { name: 'programming', description: 'Cross-domain recommendations (artists, films, brands, books) for events, playlists and collabs.', parameters: { type: 'object', properties: { entity_ids: { type: 'array', items: { type: 'string' } }, city: { type: 'string' } }, required: ['entity_ids'] } },
];
