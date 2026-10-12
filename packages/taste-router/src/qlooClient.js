// Minimal, dependency-free client for the Qloo Taste AI API.
// Docs: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide

export const DEFAULT_BASE_URL = 'https://hackathon.api.qloo.com';

export const ENTITY_TYPES = {
  artist: 'urn:entity:artist',
  album: 'urn:entity:album',
  movie: 'urn:entity:movie',
  tv_show: 'urn:entity:tv_show',
  book: 'urn:entity:book',
  podcast: 'urn:entity:podcast',
  videogame: 'urn:entity:videogame',
  brand: 'urn:entity:brand',
  place: 'urn:entity:place',
  destination: 'urn:entity:destination',
  person: 'urn:entity:person',
};

export class QlooError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'QlooError';
    this.status = status;
  }
}

export function resolveType(type) {
  if (!type) return undefined;
  if (type.startsWith('urn:entity:')) return type;
  const t = ENTITY_TYPES[type];
  if (!t) throw new QlooError(`Unknown entity type "${type}". Use one of: ${Object.keys(ENTITY_TYPES).join(', ')}`);
  return t;
}

export function createQlooClient({
  apiKey = process.env.QLOO_API_KEY,
  baseUrl = process.env.QLOO_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
} = {}) {
  if (!apiKey) throw new QlooError('QLOO_API_KEY is not set');

  async function get(path, params) {
    const url = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    const res = await fetchImpl(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new QlooError(`Qloo ${res.status} on ${url.pathname}: ${body.slice(0, 200)}`, res.status);
    }
    return res.json();
  }

  return {
    /** Resolve a free-text name to Qloo entities. */
    async search(query, { type, take = 3 } = {}) {
      const data = await get('/search', { query, types: resolveType(type), take });
      return (data.results || []).map(normalizeEntity);
    },

    /** Taste-based recommendations of `type`, anchored on seed entity ids. */
    async insights({ type, entityIds = [], locationQuery, take = 5 }) {
      const data = await get('/v2/insights', {
        'filter.type': resolveType(type),
        'signal.interests.entities': entityIds,
        'signal.location.query': locationQuery,
        take,
      });
      const entities = data?.results?.entities || [];
      return entities.map(normalizeEntity);
    },
  };
}

export function normalizeEntity(e = {}) {
  return {
    id: e.entity_id || e.id,
    name: e.name,
    type: e.subtype || e.type || (e.types && e.types[0]),
    affinity: e.query?.affinity ?? e.affinity ?? null,
    popularity: e.popularity ?? null,
    description: e.properties?.description || e.properties?.short_description || '',
    image: e.properties?.image?.url || null,
    address: e.properties?.address || null,
  };
}
