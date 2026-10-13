// TasteRouter agent: plan -> resolve -> (reflect) -> fan out over Qloo -> adapt -> scout -> rank -> write.
// Every step is emitted as an event so the UI can show the agent's reasoning live and judges can audit it.
import { makeTools } from './tools.js';
import { geocodeCity } from './geocode.js';
import { parseJSON } from './llm.js';

const PLAN_PROMPT = `You are the planning step of TasteRouter, an agent that finds the city neighbourhood whose residents already love a business concept's taste.
Read the founder's brief and return ONLY JSON:
{"concept":"short name of the business/event","concept_terms":["1-3 place-category words, e.g. 'wine bar','record store','bakery'"],"city":"city name","seeds":[{"name":"...","type":"artist|movie|tv|book|brand"}],"audience_note":"one line on who it's for"}
Seeds are 3-5 specific, real cultural references that capture the vibe: musicians, films, TV shows, books, or consumer brands. Never use neighbourhoods, cities or generic words as seeds. For a film director, use their best-known film title (e.g. Wong Kar-wai -> "In the Mood for Love", type movie). Use the references the brief names; if fewer than 3, add well-known ones that clearly fit the stated vibe. No commentary.`;

const REFLECT_PROMPT = `Some taste references could not be found in the Qloo knowledge graph. Suggest replacements: specific, well-known real entities with the same vibe. Return ONLY JSON {"seeds":[{"name":"...","type":"artist|movie|tv|book|brand|place"}]}`;

const WRITE_PROMPT = `You are TasteRouter's strategist. Write a launch brief for the founder using ONLY the Qloo evidence provided (neighbourhoods, anchor venues, competitor counts, audience skew, taste tags, cross-domain recommendations). Never invent venues, numbers or names that are not in the evidence.
Return ONLY JSON:
{"headline":"one punchy sentence naming the recommended neighbourhood",
 "pick":{"neighborhood":"...","why":["2-3 short evidence-backed reasons"]},
 "runner_up":{"neighborhood":"...","why":"one line"},
 "positioning":"one sentence on how to pitch the place to this audience",
 "opening_week":[{"night":"e.g. Thu","idea":"event idea using a named artist/film from evidence"}],
 "collabs":["brand or venue from evidence + why, short"],
 "menu_and_vibe":["3-4 cues drawn from the taste tags"],
 "risks":["1-2 honest risks, e.g. competition or audience mismatch"]}
opening_week has exactly 3 items.`;

const BASELINE_PROMPT = `You are a helpful assistant. A founder asks for advice. Answer from general knowledge only in ~120 words: which neighbourhood should they open in, and what should their opening week look like?`;

export async function runScout(input, { qloo, llm, store, emit = () => {}, fetchImpl = fetch, withBaseline = true } = {}) {
  const tools = makeTools(qloo);
  const t0 = Date.now();
  const step = async (name, label, fn) => {
    const s = Date.now();
    emit({ type: 'step', name, status: 'start', label });
    try {
      const out = await fn();
      emit({ type: 'step', name, status: 'done', label, ms: Date.now() - s, summary: summarize(name, out) });
      return out;
    } catch (e) {
      emit({ type: 'step', name, status: 'error', label, ms: Date.now() - s, error: String(e.message || e) });
      throw e;
    }
  };

  // 1. PLAN — turn a messy brief into a structured plan (LLM), or accept a structured request directly.
  let plan = await step('plan', 'Reading the brief and planning the search', async () => {
    if (input.seeds?.length && input.city) return { concept: input.concept || 'your concept', concept_terms: input.concept_terms || [input.concept || 'bar'], city: input.city, seeds: input.seeds.map(s => (typeof s === 'string' ? { name: s } : s)), audience_note: input.audience_note || '', planner: 'structured' };
    if (!llm) throw new Error('Free-text briefs need an LLM; send {concept, city, seeds[]} instead.');
    const p = parseJSON(await llm.chat([{ role: 'system', content: PLAN_PROMPT }, { role: 'user', content: input.brief }], { maxTokens: 500, temperature: 0.2 }));
    if (!p?.city || !p?.seeds?.length) throw new Error('Could not read a city and taste references from the brief.');
    if (input.city) p.city = input.city;
    return { ...p, planner: llm.name };
  });

  // Baseline answer without Qloo runs in parallel, so the UI can show "LLM alone vs. LLM + Qloo".
  const baselineP = withBaseline && llm && input.brief
    ? llm.chat([{ role: 'system', content: BASELINE_PROMPT }, { role: 'user', content: input.brief }], { maxTokens: 300, temperature: 0.5 }).catch(() => null)
    : Promise.resolve(null);

  // 2. RESOLVE — ground the references in Qloo's entity graph; 3. REFLECT if too few resolve.
  let seeds = await step('resolve', 'Grounding taste references in Qloo entities', () => tools.resolve_seeds({ seeds: plan.seeds }));
  if (seeds.resolved.length < 2 && llm) {
    const alt = await step('reflect', `Only ${seeds.resolved.length} reference(s) found; asking for stand-ins for ${seeds.missing.join(', ')}`, async () => {
      const r = parseJSON(await llm.chat([{ role: 'system', content: REFLECT_PROMPT }, { role: 'user', content: `Concept: ${plan.concept}. Missing: ${seeds.missing.join(', ')}. Found: ${seeds.resolved.map(s => s.name).join(', ') || 'none'}.` }], { maxTokens: 300 }));
      return tools.resolve_seeds({ seeds: r?.seeds || [] });
    });
    seeds = { resolved: [...seeds.resolved, ...alt.resolved].slice(0, 5), missing: seeds.missing };
  }
  if (!seeds.resolved.length) throw new Error('None of the taste references exist in Qloo; try naming specific artists, films or brands.');
  const ids = seeds.resolved.map(s => s.id);

  const center = await step('geocode', `Locating ${plan.city}`, async () => {
    const g = await geocodeCity(plan.city, { fetchImpl, store });
    if (!g) throw new Error(`Could not find the city "${plan.city}".`);
    return g;
  });

  // 4. FAN OUT — independent Qloo questions in parallel.
  const [concept, dna, audience, heat, programming] = await Promise.all([
    step('concept', 'Mapping the concept to Qloo place categories', () => tools.concept_tags({ terms: plan.concept_terms?.length ? plan.concept_terms : [plan.concept] })),
    step('dna', 'Reading the taste DNA of the audience', () => tools.taste_dna({ entity_ids: ids })),
    step('audience', 'Profiling who this audience is', () => tools.audience({ entity_ids: ids })),
    step('heatmap', `Mapping where this taste lives in ${plan.city}`, () => tools.hotspots({ entity_ids: ids, city: plan.city, center })),
    step('programming', 'Pulling cross-domain picks for programming and collabs', () => tools.programming({ entity_ids: ids, city: plan.city })),
  ]);

  // 5. ADAPT — a thin heatmap means the city window or the signal is off; widen and retry once.
  let hot = heat;
  if (hot.hotspots.length < 2) {
    hot = await step('adapt', 'Heatmap too sparse; widening the search window', () => tools.hotspots({ entity_ids: ids, city: plan.city, center: { ...center, radius_m: Math.min(30000, center.radius_m * 2) } }));
  }

  // 6. SCOUT — ground-truth the top hotspots: neighbourhood, taste-matched anchors, competition.
  const scouted = await step('scout', `Scouting the top ${Math.min(3, hot.hotspots.length)} hotspots on the ground`, () =>
    Promise.all(hot.hotspots.slice(0, 3).map(async h => ({ ...h, ...(await tools.scout_hotspot({ lat: h.lat, lon: h.lon, entity_ids: ids, category_tag: concept.category?.id })) }))));

  // 7. RANK — taste concentration vs. saturation of the same category.
  const maxComp = Math.max(1, ...scouted.map(s => s.competitor_count || 0));
  const ranked = scouted
    .map(s => {
      const saturation = s.competitor_count == null ? 0.5 : s.competitor_count / maxComp;
      const opportunity = +(0.65 * s.score + 0.35 * (1 - saturation)).toFixed(3);
      const label = s.competitor_count == null ? 'unknown supply' : s.competitor_count <= 3 ? 'white space' : saturation > 0.75 ? 'proven but crowded' : 'healthy demand';
      return { ...s, opportunity, label };
    })
    .sort((a, b) => b.opportunity - a.opportunity);
  emit({ type: 'step', name: 'rank', status: 'done', label: 'Ranking hotspots: taste concentration vs. category saturation', summary: ranked.map(r => `${r.neighborhood || 'area'} ${Math.round(r.opportunity * 100)}`).join(' · ') });

  const evidence = {
    concept: plan.concept, city: plan.city, audience_note: plan.audience_note,
    seeds: seeds.resolved.map(s => ({ name: s.name, type: s.type })),
    category: concept.category, vibe_tags: concept.vibes.map(v => v.name),
    taste_dna: Object.fromEntries(Object.entries(dna.groups).map(([k, v]) => [k, v.map(t => t.name)])),
    audience: audience,
    neighborhoods: ranked.map(r => ({ name: r.neighborhood, opportunity: r.opportunity, label: r.label, competitors_nearby: r.competitor_count, anchors: r.anchors.map(a => `${a.name}${a.tags.length ? ` (${a.tags.join(', ')})` : ''}`) })),
    programming: Object.fromEntries(Object.entries(programming).map(([k, v]) => [k, v.map(e => e.name)])),
  };

  // 8. WRITE — LLM turns evidence into a brief; deterministic fallback keeps the demo alive if the LLM is down.
  const brief = await step('write', 'Writing the launch brief from Qloo evidence', async () => {
    if (llm) {
      try {
        const b = parseJSON(await llm.chat([{ role: 'system', content: WRITE_PROMPT }, { role: 'user', content: JSON.stringify(evidence) }], { maxTokens: 1100 }));
        if (b?.headline) return { ...b, writer: llm.name };
      } catch (e) { emit({ type: 'note', text: `LLM writer unavailable (${e.message}); using deterministic brief.` }); }
    }
    return fallbackBrief(evidence);
  });

  const baseline = await baselineP;
  const result = {
    plan, seeds, center, concept, dna, audience, programming,
    heatmap: { cells: hot.cells, cell_count: hot.cell_count },
    neighborhoods: ranked, brief, baseline,
    meta: { ms: Date.now() - t0, llm: llm?.name || null, generated_at: new Date().toISOString() },
  };
  emit({ type: 'result', result });
  return result;
}

function summarize(name, out) {
  try {
    switch (name) {
      case 'plan': return `${out.concept} in ${out.city}; refs: ${out.seeds.map(s => s.name).join(', ')}`;
      case 'resolve': case 'reflect': return `${out.resolved.map(s => `${s.name} (${String(s.type).split(':').pop()})`).join(', ')}${out.missing?.length ? `; not found: ${out.missing.join(', ')}` : ''}`;
      case 'geocode': return `${out.name} · ${Math.round(out.radius_m / 1000)} km window`;
      case 'concept': return `${out.category?.name || 'no category'}${out.vibes.length ? ` · ${out.vibes.slice(0, 3).map(v => v.name).join(', ')}` : ''}`;
      case 'dna': return Object.values(out.groups).flat().slice(0, 6).map(t => t.name).join(', ');
      case 'audience': return out.top_age ? `over-indexes ${out.top_age.replaceAll('_', ' ')} (+${Math.round(out.top_age_lift * 100)}%)` : 'no skew';
      case 'heatmap': case 'adapt': return `${out.cell_count} cells → ${out.hotspots.length} hotspots`;
      case 'scout': return out.map(s => `${s.neighborhood || '?'}: ${s.competitor_count ?? '?'} competitors`).join(' · ');
      case 'programming': return `${out.artists?.slice(0, 2).map(e => e.name).join(', ')} · ${out.films?.slice(0, 2).map(e => e.name).join(', ')}`;
      case 'write': return out.headline;
      default: return '';
    }
  } catch { return ''; }
}

export function fallbackBrief(ev) {
  const [a, b] = ev.neighborhoods;
  const p = ev.programming;
  return {
    headline: `Open your ${ev.concept} in ${a?.name || 'the top hotspot'}: it is where ${ev.seeds.map(s => s.name).slice(0, 2).join(' and ')} fans concentrate in ${ev.city}.`,
    pick: { neighborhood: a?.name, why: [`Top taste-opportunity score (${Math.round((a?.opportunity || 0) * 100)}/100, ${a?.label}).`, `${a?.competitors_nearby ?? '?'} ${ev.category?.name || 'similar'} venues nearby.`, a?.anchors?.[0] ? `Taste-matched anchor: ${a.anchors[0]}.` : ''].filter(Boolean) },
    runner_up: b ? { neighborhood: b.name, why: `${b.label}, score ${Math.round(b.opportunity * 100)}.` } : null,
    positioning: `For people who love ${ev.seeds.map(s => s.name).join(', ')}.`,
    opening_week: [
      { night: 'Thu', idea: `Listening night: ${p.artists?.slice(0, 2).join(' + ') || 'curated set'}` },
      { night: 'Fri', idea: `Screening: ${p.films?.[0] || 'a cult film'}` },
      { night: 'Sat', idea: `Pop-up with ${p.brands?.[0] || 'a local brand'}` },
    ],
    collabs: (p.brands || []).slice(0, 3),
    menu_and_vibe: [...(ev.taste_dna.vibe || []), ...(ev.taste_dna.menu || [])].slice(0, 4),
    risks: [a?.label === 'proven but crowded' ? 'Crowded category nearby; differentiate hard.' : 'Validate foot traffic and rent before signing.'],
    writer: 'deterministic',
  };
}
