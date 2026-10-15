// TasteRouter agent: plan -> resolve -> (reflect) -> fan out over Qloo -> adapt -> scout -> rank -> write.
// Every step is emitted as an event so the UI can show the agent's reasoning live and judges can audit it.
import { makeTools } from './tools.js';
import { geocodeCity } from './geocode.js';
import { parseJSON } from './llm.js';
import { haversineKm } from './geo.js';
import { allowedKit, groundingIssues } from './grounding.js';

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
opening_week has exactly 3 items. Taste-Fit Scores are out of 100; quote them as e.g. "Taste-Fit 77/100", never as decimals. Use short weekday names exactly once each.`;

// Taste-Fit Score (0-100), TasteRouter's single headline metric for a neighbourhood. Three Qloo-measured parts:
//   taste depth      40%  mean Qloo heatmap affinity of every cell within 1.5 km of the hotspot (the heatmap is
//                         rank-normalised inside a city, so 0.77 reads as "this area sits at the 77th percentile")
//   audience overlap 30%  mean Qloo affinity of the top-3 taste-matched venues within 900 m (absolute overlap
//                         between the seeds' fans and the people who go to real venues there)
//   white space      30%  1 - category saturation; saturation blends the competitor count relative to the other
//                         hotspots with an absolute scale (50 = Qloo page cap)
// Ties break on fewer competitors, then stronger taste peak, then more taste-matched anchors.
// Two hotspots resolving to the same neighbourhood are disambiguated by compass bearing.
export const COMPETITOR_CAP = 50;
export const FIT_WEIGHTS = { taste: 0.4, overlap: 0.3, space: 0.3 };
const clamp01 = x => Math.max(0, Math.min(1, x));
export function audienceOverlap(anchors) {
  const top = (anchors || []).map(a => a.affinity).filter(x => x > 0).sort((a, b) => b - a).slice(0, 3);
  return top.length ? clamp01(top.reduce((t, x) => t + x, 0) / top.length) : 0;
}
export function tasteDepth(h, cells, radiusKm = 1.5) {
  const near = (cells || []).filter(([lat, lon]) => haversineKm({ lat, lon }, h) <= radiusKm);
  return near.length >= 3 ? clamp01(near.reduce((t, c) => t + c[2], 0) / near.length) : clamp01(h.score || 0);
}
export function tasteFit(parts, w = FIT_WEIGHTS) {
  const sum = (w.taste + w.overlap + w.space) || 1;
  return Math.round(100 * (w.taste * parts.taste + w.overlap * parts.overlap + w.space * parts.space) / sum);
}
export function verdictFor(fit) {
  return fit >= 80 ? { word: 'Your people are here', advice: 'Start your site search here.' } : fit >= 65 ? { word: 'Worth a visit', advice: 'Spend an evening here before you sign anything.' } : { word: 'A harder road', advice: 'Possible, but you would be building the crowd yourself.' };
}
export function rankHotspots(scouted, { cells, weights: w = FIT_WEIGHTS } = {}) {
  const maxComp = Math.max(1, ...scouted.map(s => s.competitor_count || 0));
  const ranked = scouted.map(s => {
    const c = s.competitor_count;
    const saturation = c == null ? 0.5 : 0.5 * (c / maxComp) + 0.5 * Math.min(1, c / COMPETITOR_CAP);
    const fit_parts = { taste: +tasteDepth(s, cells).toFixed(3), overlap: +audienceOverlap(s.anchors).toFixed(3), space: +(1 - saturation).toFixed(3) };
    const fit = tasteFit(fit_parts, w);
    const label = c == null ? 'unknown supply' : c <= 3 ? 'white space' : saturation > 0.75 ? 'proven but crowded' : 'healthy demand';
    return { ...s, fit, fit_parts, verdict: verdictFor(fit).word, opportunity: fit / 100, saturation: +saturation.toFixed(3), label, ...(c === 0 ? { note: 'No same-category venue found within 900 m: first mover, but validate demand on the ground.' } : {}) };
  }).sort((a, b) => (b.fit - a.fit) || ((a.competitor_count ?? 99) - (b.competitor_count ?? 99)) || ((b.peak || 0) - (a.peak || 0)) || ((b.anchors?.length || 0) - (a.anchors?.length || 0)));
  const seen = {};
  for (const r of ranked) { const n = r.neighborhood; if (n) (seen[n] ||= []).push(r); }
  for (const group of Object.values(seen)) {
    if (group.length < 2) continue;
    const lat0 = group.reduce((t, r) => t + r.lat, 0) / group.length, lon0 = group.reduce((t, r) => t + r.lon, 0) / group.length;
    for (const r of group) {
      const dLat = r.lat - lat0, dLon = r.lon - lon0;
      const dir = Math.abs(dLat) >= Math.abs(dLon) ? (dLat >= 0 ? 'north' : 'south') : (dLon >= 0 ? 'east' : 'west');
      r.neighborhood = `${r.neighborhood} (${dir})`;
    }
  }
  return ranked;
}

/** One verdict for the whole run: the top neighbourhood, its Taste-Fit, the lead over #2, and how much evidence backs it. */
export function verdictCard(ranked, cellCount = 0) {
  const [a, b] = ranked;
  if (!a) return null;
  const v = verdictFor(a.fit);
  const anchors = (a.anchors || []).length;
  const confidence = cellCount >= 150 && anchors >= 4 ? 'high' : cellCount >= 40 && anchors >= 2 ? 'medium' : 'low';
  return { neighborhood: a.neighborhood, fit: a.fit, verdict: v.word, advice: v.advice, lead: b ? a.fit - b.fit : null, runner_up: b?.neighborhood || null, confidence, parts: a.fit_parts, basis: `${cellCount} heatmap cells, ${anchors} taste-matched venues, ${a.competitor_count ?? '?'} competitors within 900 m` };
}

const STORY_PROMPT = `You are TasteRouter's storyteller, writing for a small, independent founder who is about to risk their savings on a dream place. Help them FEEL who their future regulars are, using ONLY the Qloo evidence given.
You get one "kit" per regular: the exact artist, film, brand, book, dish and venue Qloo says this audience loves, plus an age band where Qloo measured an over-index. Write a human portrait around each kit, like a novelist sketching a real neighbour: a small habit, a moment in their week, why they would be glad your place exists. Use at least three items from their kit. Every concrete noun you name (drink, dish, brand, artist, film, book, venue, place) must come from the evidence: do not add any other artist, film, brand, venue, dish, drink, number or place. No coffee, latte, tea, wine, beer, cocktails, snacks or shops unless they are literally in the evidence; describe moments, habits and feelings instead. Never state or imply gender: use the first name and "they".
Style: warm, concrete, unsentimental. Example of the register (do not reuse): "Saturday mornings start at the flea market and end with a used paperback; they have been looking for somewhere quiet enough to finish it."
Return ONLY JSON:
{"regulars":[{"name":"a believable first name","portrait":"35-50 words","quote":"8-16 words they might say to the founder on their first visit"}],
 "opening_night":"90-120 words, second person ('you'), present tense: the first evening of the founder's place in the #1 neighbourhood. The nerves before the door opens, the regulars arriving by name, what is playing, what they order, the moment the founder realises these are their people. Only names from the evidence.",
 "belong":[{"neighborhood":"exact neighbourhood name","line":"one warm sentence (15-30 words) on why the founder will belong there, built from THAT neighbourhood's own evidence: name one of its own venues and one of its facts (taste-fit, competitors nearby)"}],
 "verdict_line":"8-14 words, warm, about the #1 neighbourhood, e.g. 'Your people are already here; they just need somewhere to gather.'"}
"regulars" has exactly one entry per kit, in order. "belong" has one entry per neighbourhood.`;

const AGE_LABEL = { '24_and_younger': 'under 25', '25_to_29': '25–29', '30_to_34': '30–34', '35_to_44': '35–44', '45_to_54': '45–54', '55_and_older': '55+' };
/** Deterministic, Qloo-only ingredients for 3 "regulars": the LLM may only write prose around them. */
export function regularKits(ev, n = 3) {
  const P = ev.programming_full || {};
  const pick = (arr, i) => arr?.length ? arr[i % arr.length] : null;
  const ages = Object.entries(ev.audience?.skew?.age || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); // only bands Qloo says over-index
  const top = ev.neighborhoods_full?.[0];
  const anchors = top?.anchors || [];
  const menu = ev.taste_dna?.menu || [];
  const artists = [...(P.local_lean_artists || []), ...(P.artists || [])].filter((e, i, a) => a.findIndex(x => x.name === e.name) === i);
  return Array.from({ length: n }, (_, i) => ({
    age: ages[i] ? { band: AGE_LABEL[ages[i][0]] || ages[i][0].replaceAll('_', ' '), lift: Math.round(ages[i][1] * 100) } : null,
    listens: pick(artists, i), watches: pick(P.films, i), wears: pick(P.brands, i), reads: pick(P.books, i),
    eats: pick(menu, i), hangout: anchors[i] ? { name: anchors[i].name, neighborhood: top.neighborhood, image: anchors[i].image } : null,
    loves: ev.seeds[i % ev.seeds.length]?.name,
  }));
}
const slimKit = k => ({ age_band: k.age?.band, age_lift_pct: k.age?.lift, already_loves: k.loves, listens_to: k.listens?.name, watches: k.watches?.name, wears_or_uses: k.wears?.name, reads: k.reads?.name, orders: k.eats, hangs_out_at: k.hangout?.name });
// The persona copy never assumes a gender (Qloo's gender skew for these audiences is ~0).
export const GENDERED = /\b(she|he|her|his|him|hers|herself|himself)\b/i;
const NAMES = ['Mara', 'Jules', 'Sam', 'Noor', 'Theo', 'Ren'];
const list = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const plural = w => /s$/i.test(w) ? w : /y$/i.test(w) && !/[aeiou]y$/i.test(w) ? w.slice(0, -1) + 'ies' : `${w}s`;
const ordinal = n => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** The facts each neighbourhood's belonging line is built from: its own anchors, Taste-Fit parts and competitor count. */
export function hoodFacts(ev) {
  const full = ev.neighborhoods_full;
  if (full?.length) return full.map(h => ({ name: h.neighborhood, fit: h.fit, parts: h.fit_parts || {}, competitors: h.competitor_count, label: h.label, anchors: (h.anchors || []).map(a => String(a.name || '').replace(/ \(.*$/, '')).filter(Boolean) }));
  return (ev.neighborhoods || []).map(h => ({ name: h.name, fit: h.taste_fit, parts: h.fit_parts || {}, competitors: h.competitors_nearby, label: h.label, anchors: (h.anchors || []).map(a => String(a).replace(/ \(.*$/, '')) }));
}
/** Deterministic, evidence-only "why you'll belong here" line: never generic copy. */
export function belongLine(f, { city, category } = {}) {
  const cat = (category || 'similar place').toLowerCase();
  const c = f.competitors;
  const comp = c == null ? null : c === 0 ? `not a single other ${cat}` : `${c >= 50 ? '50+' : c} ${c === 1 ? cat : plural(cat)}`;
  const pct = f.parts?.taste != null ? Math.round(f.parts.taste * 100) : null;
  const ov = f.parts?.overlap != null ? Math.round(f.parts.overlap * 100) : null;
  const [a, b] = f.anchors;
  const where = a ? (b ? `${a} and ${b}` : a) : null;
  const depth = pct != null ? `this corner of ${city || 'the city'} sits in the ${ordinal(pct)} percentile for your taste` : null;
  const fit = f.fit != null ? ` (Taste-Fit ${f.fit}/100)` : '';
  if (where && f.label === 'white space') return `Your crowd already spends its evenings at ${where}, yet Qloo finds ${c ? 'only ' : ''}${comp ?? 'almost no'} within 900 m: you would be the place they have been missing${fit}.`;
  if (where && f.label === 'proven but crowded') return `The love is real here: ${depth || `your crowd gathers at ${where}`}${depth ? `, and ${where} already draw${b ? '' : 's'} your people` : ''}, but ${comp} within 900 m means you will need a sharper reason to exist${fit}.`;
  if (where) return `Your people already gather at ${where}${ov != null ? ` (${ov}% audience overlap)` : ''}; ${comp ? `${comp} within 900 m prove the demand without crowding you out` : depth || 'the taste runs deep'}${fit}.`;
  if (depth) return `No taste-matched venue stood out, but ${depth}${comp ? ` and there ${c === 1 ? 'is' : 'are'} ${comp} within 900 m` : ''}: you would be building the room your crowd lacks${fit}.`;
  return `Qloo measured a Taste-Fit of ${f.fit ?? '?'}/100 here${comp ? ` with ${comp} within 900 m` : ''}; walk it on a weeknight before you decide.`;
}

/** Deterministic portraits and opening night from the Qloo kits only (used when LLM copy fails validation). */
export function fallbackStory(ev, kits, names = NAMES) {
  const NAMES = names;
  const facts = hoodFacts(ev);
  const top = facts[0];
  const regulars = kits.map((k, i) => {
    const bits = [];
    bits.push(`${NAMES[i]}${k.age ? ` is ${k.age.band}, an age group Qloo sees leaning into this taste${k.age.lift > 0 ? ` (+${k.age.lift}%)` : ''},` : ' is one of this crowd'}${k.loves ? ` and already loves ${k.loves}` : ''}.`);
    if (k.listens) bits.push(`${k.listens.name} is on repeat on the way home${k.watches ? `, and ${k.watches.name} is the film they press on every new friend` : ''}.`);
    else if (k.watches) bits.push(`${k.watches.name} is the film they press on every new friend.`);
    if (k.hangout) bits.push(`Most weeks you would find them at ${k.hangout.name}${k.reads ? ` with ${k.reads.name} in their bag` : ''}.`);
    if (k.eats) bits.push(`Put ${k.eats.toLowerCase()} on the menu and they will order it before they sit down.`);
    else if (k.reads) bits.push(`${k.reads.name} has been in their bag for a month.`);
    return { name: NAMES[i], portrait: bits.join(' '), quote: k.watches ? `Tell me you are going to screen ${k.watches.name} one night.` : k.listens ? `If you ever play ${k.listens.name}, I will be here every week.` : 'I have been waiting for a place like this.' };
  });
  const [k0, k1, k2] = kits;
  const night = top ? [
    `It is your first night in ${top.name}, and your hands will not stop shaking as you unlock the door.`,
    `${NAMES[0]} is first in${k0?.listens ? `, and smiles when ${k0.listens.name} comes on` : ''}${k0?.eats ? `, then asks about the ${k0.eats.toLowerCase()}` : ''}.`,
    k1 ? `${NAMES[1]} comes straight from ${k1.hangout?.name || 'around the corner'}${k1.watches ? `, already talking about ${k1.watches.name}` : ''}.` : '',
    k2 ? `${NAMES[2]} takes the corner seat${k2.reads ? ` with ${k2.reads.name}` : ''} and does not leave for hours.` : '',
    `By nine the room is full of people who already love ${list(ev.seeds.map(s => s.name).slice(0, 2))}. Nobody here needed convincing: they found you because you made something for them, and for the first time in months you breathe out.`,
  ].filter(Boolean).join(' ') : '';
  return {
    regulars, opening_night: night,
    belong: facts.map(f => ({ neighborhood: f.name, line: belongLine(f, { city: ev.city, category: ev.category?.name }), writer: 'deterministic' })),
    verdict_line: 'Your people are already here: they just need somewhere to gather.',
    writer: 'deterministic',
  };
}

/** Everything the story may say must pass this check: names only from the run's Qloo kit. */
export function storyIssues(raw, kits, ev) {
  if (!raw) return ['no story'];
  const allowed = allowedKit(ev, kits);
  const names = (raw.regulars || []).map(r => r?.name).filter(n => typeof n === 'string');
  const out = [];
  (raw.regulars || []).forEach(r => out.push(...groundingIssues(`${r?.portrait || ''} ${r?.quote || ''}`, allowed, names)));
  out.push(...groundingIssues(raw.opening_night || '', allowed, names));
  (raw.belong || []).forEach(b => out.push(...groundingIssues(b?.line || '', allowed, names)));
  return [...new Set(out)];
}

/** Keep the LLM honest: any field that is thin, gendered or names something outside the Qloo kit falls back to deterministic copy. */
export function mergeStory(raw, kits, ev) {
  const allowed = allowedKit(ev, kits);
  const llmNames = kits.map((k, i) => { const n = raw?.regulars?.[i]?.name; return typeof n === 'string' && /^[A-Za-z' -]{2,20}$/.test(n) ? n : null; });
  const spare = NAMES.filter(n => !llmNames.includes(n));
  const regNames = llmNames.map(n => n || spare.shift());
  const fb0 = fallbackStory(ev, kits, regNames);
  const clean = t => typeof t === 'string' && !GENDERED.test(t) && !groundingIssues(t, allowed, regNames).length;
  let swapped = 0;
  const fb = fb0;
  const regs = kits.map((k, i) => {
    const r = raw?.regulars?.[i] || {};
    const ok = typeof r.portrait === 'string' && r.portrait.split(/\s+/).length >= 18 && r.portrait.length < 460 && new RegExp(`\\b${regNames[i]}\\b`).test(r.portrait) && clean(r.portrait);
    const qok = typeof r.quote === 'string' && r.quote.length < 140 && clean(r.quote);
    if (!ok) swapped++;
    return { name: regNames[i], portrait: ok ? r.portrait : fb.regulars[i].portrait, quote: ok && qok ? r.quote : fb.regulars[i].quote, kit: k };
  });
  const facts = hoodFacts(ev);
  const belong = facts.map((f, i) => {
    const b = (raw?.belong || []).find(x => x?.neighborhood === f.name) || null;
    const own = f.anchors.some(a => b?.line?.toLowerCase().includes(a.toLowerCase()));
    const others = facts.filter(g => g !== f).flatMap(g => g.anchors).filter(a => !f.anchors.includes(a));
    const foreign = others.some(a => a.length > 3 && b?.line?.toLowerCase().includes(a.toLowerCase()));
    const ok = b && typeof b.line === 'string' && b.line.length < 260 && own && !foreign && !/_|n['’]t fit|not a (good )?fit/i.test(b.line) && clean(b.line);
    return { neighborhood: f.name, line: ok ? b.line : fb.belong[i].line, writer: ok ? 'llm' : 'deterministic', facts: { taste_fit: f.fit, taste_pct: f.parts?.taste != null ? Math.round(f.parts.taste * 100) : null, overlap_pct: f.parts?.overlap != null ? Math.round(f.parts.overlap * 100) : null, competitors: f.competitors, anchors: f.anchors.slice(0, 2) } };
  });
  // The opening night may only use names that survived: if any portrait was replaced, use the deterministic night too.
  const nightOk = typeof raw?.opening_night === 'string' && raw.opening_night.length > 60 && raw.opening_night.length < 1100 && clean(raw.opening_night) && !swapped;
  const vline = typeof raw?.verdict_line === 'string' && raw.verdict_line.length < 120 && clean(raw.verdict_line) ? raw.verdict_line : fb.verdict_line;
  return { regulars: regs, opening_night: nightOk ? raw.opening_night : fb.opening_night, belong, verdict_line: vline, writer: raw ? raw.writer : 'deterministic', grounded: { portraits_replaced: swapped, night_replaced: !nightOk, belong_deterministic: belong.filter(b => b.writer === 'deterministic').length } };
}

const BASELINE_PROMPT = `You are a helpful assistant. A founder asks for advice. Answer from general knowledge only in ~120 words: which neighbourhood should they open in, and what should their opening week look like?`;

export async function runScout(input, { qloo, llm, store, emit = () => {}, fetchImpl = fetch, withBaseline = true, storyModel } = {}) {
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
  const ranked = rankHotspots(scouted, { cells: hot.cells });
  emit({ type: 'step', name: 'rank', status: 'done', label: 'Scoring Taste-Fit: taste concentration + audience overlap + white space', summary: ranked.map(r => `${r.neighborhood || 'area'} ${r.fit}`).join(' · ') });

  const evidence = {
    concept: plan.concept, city: plan.city, audience_note: plan.audience_note,
    seeds: seeds.resolved.map(s => ({ name: s.name, type: s.type })),
    category: concept.category, vibe_tags: concept.vibes.map(v => v.name),
    taste_dna: Object.fromEntries(Object.entries(dna.groups).map(([k, v]) => [k, v.map(t => t.name)])),
    audience: audience,
    neighborhoods: ranked.map(r => ({ name: r.neighborhood, taste_fit: r.fit, verdict: r.verdict, label: r.label, competitors_nearby: r.competitor_count, anchors: r.anchors.map(a => `${a.name}${a.tags.length ? ` (${a.tags.join(', ')})` : ''}`) })),
    programming: Object.fromEntries(Object.entries(programming).map(([k, v]) => [k, v.map(e => e.name)])),
  };

  // 8. WRITE — the launch brief and, in parallel, the human story (regulars, opening night) from the same evidence.
  // Deterministic fallbacks keep the demo alive if the LLM is down.
  const kitEv = { ...evidence, programming_full: programming, neighborhoods_full: ranked };
  const kits = regularKits(kitEv);
  const [brief, story] = await Promise.all([
    step('write', 'Writing the launch brief from Qloo evidence', async () => {
      if (llm) {
        try {
          const b = parseJSON(await llm.chat([{ role: 'system', content: WRITE_PROMPT }, { role: 'user', content: JSON.stringify(evidence) }], { maxTokens: 1100 }));
          if (b?.headline) return { ...b, writer: llm.name };
        } catch (e) { emit({ type: 'note', text: `LLM writer unavailable (${e.message}); using deterministic brief.` }); }
      }
      return fallbackBrief(evidence);
    }),
    step('story', 'Meeting your future regulars', async () => {
      let raw = null;
      if (llm) {
        try {
          const msgs = [{ role: 'system', content: STORY_PROMPT }, { role: 'user', content: JSON.stringify({ concept: evidence.concept, city: evidence.city, audience_note: evidence.audience_note, kits: kits.map(slimKit), neighborhoods: evidence.neighborhoods.map(n => ({ name: n.name, taste_fit: n.taste_fit, competitors_within_900m: n.competitors_nearby, label: n.label, venues: n.anchors.slice(0, 3) })) }) }];
          let best = null, bestScore = Infinity;
          for (let attempt = 0; attempt < 3; attempt++) {
            raw = parseJSON(await llm.chat(msgs, { maxTokens: 1200, temperature: 0.7, ...(storyModel ? { model: storyModel } : {}) }).catch(() => ''));
            const thin = !raw?.regulars?.length || raw.regulars.length < kits.length || String(raw.opening_night || '').split(/\s+/).length < 60 || raw.regulars.some(r => String(r.portrait || '').split(/\s+/).length < 18) || GENDERED.test([...raw.regulars.map(r => `${r.portrait} ${r.quote}`), raw.opening_night].join(' '));
            const invented = raw?.regulars ? storyIssues(raw, kits, kitEv) : ['no story'];
            const score = invented.length + (thin ? 3 : 0);
            if (raw && score < bestScore) { best = raw; bestScore = score; }
            if (!thin && !invented.length) break;
            if (invented.length) {
              emit({ type: 'note', text: `Story named things Qloo never returned (${invented.slice(0, 5).join(', ')}); rewriting with the Qloo kit only.` });
              msgs.push({ role: 'assistant', content: JSON.stringify(raw) }, { role: 'user', content: `Rewrite the JSON. These are not in the Qloo evidence and must be removed: ${invented.join(', ')}. Name only items from the kits and neighbourhood venues.` });
            }
          }
          raw = best || raw; // the attempt with the fewest problems; mergeStory still swaps any bad field for Qloo-only copy
          if (raw) raw.writer = storyModel ? `workers-ai:${storyModel.split('/').pop()}` : llm.name;
        } catch { raw = null; }
      }
      return mergeStory(raw, kits, kitEv);
    }),
  ]);

  const baseline = await baselineP;
  const result = {
    plan, seeds, center, concept, dna, audience, programming,
    heatmap: { cells: hot.cells, cell_count: hot.cell_count },
    neighborhoods: ranked, verdict: ranked.length ? { ...verdictCard(ranked, hot.cell_count), line: story.verdict_line } : null, story, brief, baseline,
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
      case 'story': return out.regulars.map(r => r.name).join(', ') + ' are on their way';
      default: return '';
    }
  } catch { return ''; }
}

export function fallbackBrief(ev) {
  const [a, b] = ev.neighborhoods;
  const p = ev.programming;
  return {
    headline: `Open your ${ev.concept} in ${a?.name || 'the top hotspot'}: it is where ${ev.seeds.map(s => s.name).slice(0, 2).join(' and ')} fans concentrate in ${ev.city}.`,
    pick: { neighborhood: a?.name, why: [`Highest Taste-Fit Score (${a?.taste_fit ?? 0}/100, ${a?.label}).`, `${a?.competitors_nearby ?? '?'} ${ev.category?.name || 'similar'} venues nearby.`, a?.anchors?.[0] ? `Taste-matched anchor: ${a.anchors[0]}.` : ''].filter(Boolean) },
    runner_up: b ? { neighborhood: b.name, why: `${b.label}, Taste-Fit ${b.taste_fit}/100.` } : null,
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
