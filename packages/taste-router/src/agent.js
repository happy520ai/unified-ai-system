// TasteRouter agent: turns what a person loves into cross-domain picks.
// Loop: understand -> resolve seeds (Qloo search) -> fan out (Qloo insights per domain)
//       -> rank & dedupe -> explain (optional LLM, deterministic fallback).

export const DOMAIN_TO_TYPE = {
  music: 'artist',
  movies: 'movie',
  tv: 'tv_show',
  books: 'book',
  podcasts: 'podcast',
  games: 'videogame',
  brands: 'brand',
  dining: 'place',
  travel: 'destination',
};

const KEYWORDS = {
  dining: /restaurant|eat|dinner|lunch|food|cafe|coffee|bar|餐|吃|咖啡/i,
  travel: /trip|travel|vacation|visit|destination|旅行|旅游|去哪/i,
  music: /music|song|artist|band|playlist|音乐|歌/i,
  movies: /movie|film|cinema|电影/i,
  tv: /\btv\b|series|show|剧/i,
  books: /book|read|novel|书|小说/i,
  podcasts: /podcast|播客/i,
  games: /game|游戏/i,
  brands: /gift|brand|fashion|wear|shop|礼物|品牌|穿/i,
};

/** Pick the domains a request is about; default to a balanced trio. */
export function planDomains(goal = '', requested = []) {
  if (requested.length) return requested.filter((d) => DOMAIN_TO_TYPE[d]);
  const hits = Object.entries(KEYWORDS).filter(([, re]) => re.test(goal)).map(([d]) => d);
  return hits.length ? hits : ['music', 'movies', 'dining'];
}

export function createTasteAgent({ qloo, llm = null, log = () => {} }) {
  async function resolveSeeds(likes) {
    const seeds = [];
    for (const like of likes) {
      const name = typeof like === 'string' ? like : like.name;
      const type = typeof like === 'string' ? undefined : like.type;
      const [hit] = await qloo.search(name, { type, take: 1 });
      if (hit?.id) seeds.push({ query: name, ...hit });
      else log(`no Qloo match for "${name}"`);
    }
    return seeds;
  }

  async function recommend({ likes = [], goal = '', domains = [], location, take = 5 }) {
    if (!likes.length) throw new Error('Give at least one thing the person likes');
    const trace = [];
    const seeds = await resolveSeeds(likes);
    trace.push({ step: 'resolve_seeds', seeds: seeds.map((s) => `${s.name} (${s.type})`) });
    if (!seeds.length) return { seeds, picks: {}, summary: 'None of those names matched Qloo entities.', trace };

    const plan = planDomains(goal, domains);
    trace.push({ step: 'plan', domains: plan });

    const seedIds = new Set(seeds.map((s) => s.id));
    const picks = {};
    await Promise.all(
      plan.map(async (domain) => {
        const type = DOMAIN_TO_TYPE[domain];
        const needsLocation = domain === 'dining';
        try {
          const results = await qloo.insights({
            type,
            entityIds: [...seedIds],
            locationQuery: needsLocation ? location : undefined,
            take: take + seedIds.size,
          });
          picks[domain] = results.filter((r) => !seedIds.has(r.id)).slice(0, take);
        } catch (err) {
          picks[domain] = [];
          trace.push({ step: 'error', domain, message: err.message });
        }
      }),
    );
    trace.push({ step: 'fan_out', counts: Object.fromEntries(Object.entries(picks).map(([d, r]) => [d, r.length])) });

    const summary = await explain({ seeds, picks, goal, location });
    return { seeds, picks, summary, trace };
  }

  async function explain({ seeds, picks, goal, location }) {
    const seedNames = seeds.map((s) => s.name).join(', ');
    if (llm) {
      try {
        const prompt = `Someone loves ${seedNames}. Goal: ${goal || 'discover new things'}${location ? ` in ${location}` : ''}.\n` +
          `Qloo taste data suggests:\n${JSON.stringify(Object.fromEntries(Object.entries(picks).map(([d, r]) => [d, r.map((x) => x.name)])))}\n` +
          'Write a short, specific plan using only these picks. Explain the taste link in one line each.';
        return await llm(prompt);
      } catch {
        /* fall through to deterministic summary */
      }
    }
    const lines = Object.entries(picks)
      .filter(([, r]) => r.length)
      .map(([d, r]) => `${d}: ${r.slice(0, 3).map((x) => x.name).join(', ')}`);
    return `Because you like ${seedNames} - ${lines.join('; ') || 'no matches found'}.`;
  }

  return { recommend, resolveSeeds };
}

/** Optional OpenAI-compatible chat call (works with OpenRouter, Groq, etc). */
export function createLlmFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  if (!env.LLM_API_KEY) return null;
  const base = env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = env.LLM_MODEL || 'openai/gpt-4o-mini';
  return async (prompt) => {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.4 }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  };
}
