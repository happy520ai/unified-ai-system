// Minimal, dependency-free Qloo Taste AI client (works in Node 20+, Cloudflare Workers, browsers-behind-proxy).
export class QlooError extends Error {
  constructor(message, status, path) { super(message); this.status = status; this.path = path; }
}

// The hackathon key allows 5 requests/second and 10,000/month, so every call goes through a
// rate-limited queue and an optional persistent cache ({ get(key), put(key, value) }), e.g. Workers KV.
export function createQloo({ apiKey, baseUrl = 'https://hackathon.api.qloo.com', fetchImpl = fetch, timeoutMs = 15000, onCall, store, perSecond = 4 } = {}) {
  if (!apiKey) throw new Error('QLOO_API_KEY is required');
  const cache = new Map();
  const stamps = [];
  async function slot() {
    for (;;) {
      const now = Date.now();
      while (stamps.length && now - stamps[0] > 1000) stamps.shift();
      if (stamps.length < perSecond) { stamps.push(now); return; }
      await new Promise(r => setTimeout(r, 1000 - (now - stamps[0]) + 15));
    }
  }

  async function get(path, params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    qs.sort();
    const url = `${baseUrl}${path}?${qs}`;
    if (cache.has(url)) return cache.get(url);
    const started = Date.now();
    const p = (async () => {
      const key = `q:${path}?${qs}`;
      if (store) { const hit = await store.get(key).catch(() => null); if (hit) { onCall?.({ path, params, ms: 0, ok: true, cached: true }); return hit; } }
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        await slot();
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetchImpl(url, { headers: { 'X-Api-Key': apiKey, accept: 'application/json' }, signal: ctrl.signal });
          clearTimeout(t);
          if (res.status === 429 || res.status >= 500) { lastErr = new QlooError(`Qloo ${res.status}`, res.status, path); await new Promise(r => setTimeout(r, 1100 * (attempt + 1))); continue; }
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new QlooError(body?.errors?.[0]?.message || body?.error?.message || body?.message || `Qloo ${res.status}`, res.status, path);
          onCall?.({ path, params, ms: Date.now() - started, ok: true });
          if (store) await store.put(key, body).catch(() => {});
          return body;
        } catch (e) { clearTimeout(t); lastErr = e; if (e instanceof QlooError && e.status < 500 && e.status !== 429) break; }
      }
      onCall?.({ path, params, ms: Date.now() - started, ok: false, error: String(lastErr?.message || lastErr) });
      throw lastErr;
    })();
    cache.set(url, p);
    p.catch(() => cache.delete(url));
    return p;
  }

  return {
    get,
    search: (query, { types, take = 3 } = {}) => get('/search', { query, types, take }),
    tags: (query, { take = 5 } = {}) => get('/v2/tags', { 'filter.query': query, take }),
    insights: (params) => get('/v2/insights', params),
  };
}
