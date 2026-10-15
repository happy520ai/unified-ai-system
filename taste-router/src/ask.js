// Follow-up chat on a finished report. The LLM answers ONLY from the run's stored evidence, plus at most one
// small tool call: a deterministic re-score of the Taste-Fit with different weights (0 Qloo calls), or a lookup of
// taste-matched venues with a given Qloo tag (e.g. "inexpensive") around each scouted hotspot (<= 4 Qloo calls).
import { parseJSON } from './llm.js';
import { tasteFit, verdictFor, FIT_WEIGHTS } from './agent.js';

export const MAX_ASK_QLOO_CALLS = 4;

/** The compact, citation-friendly evidence the chat is allowed to use. */
export function chatEvidence(r) {
  if (r.route) {
    return {
      kind: 'tour', artist: r.seeds.resolved.map(s => s.name), route: r.route.order, route_km: r.route.km, rank_order_km: r.route.rank_order_km,
      markets: r.cities.map((c, i) => ({ rank: i + 1, city: c.city, taste_fit: Math.round(c.score * 100), taste_peak: Math.round(c.peak * 100), hottest_area: c.neighborhood, venues: (c.anchors || []).map(a => `${a.name} (affinity ${Math.round(a.affinity * 100)})`) })),
      note: r.note, fan_night: r.fan_night && { city: r.fan_night.city, neighborhood: r.fan_night.neighborhood, room: r.fan_night.room?.name, local_openers: r.fan_night.openers?.map(o => o.name) },
    };
  }
  const tags = Object.fromEntries(Object.entries(r.dna?.groups || {}).map(([k, v]) => [k, v.map(t => t.name)]));
  return {
    kind: 'scout', concept: r.plan.concept, city: r.plan.city, category: r.concept?.category?.name,
    seeds: r.seeds.resolved.map(s => s.name),
    neighborhoods: r.neighborhoods.map((h, i) => ({
      rank: i + 1, name: h.neighborhood, taste_fit: h.fit ?? Math.round(h.opportunity * 100), verdict: h.verdict, label: h.label,
      parts: h.fit_parts && { taste_depth: Math.round(h.fit_parts.taste * 100), audience_overlap: Math.round(h.fit_parts.overlap * 100), white_space: Math.round(h.fit_parts.space * 100) },
      competitors_within_900m: h.competitor_count, competitor_examples: (h.competitors || []).slice(0, 5),
      taste_matched_venues: (h.anchors || []).map(a => `${a.name}${a.tags?.length ? ` [${a.tags.join(', ')}]` : ''} (affinity ${Math.round((a.affinity || 0) * 100)})`),
      ...(h.note ? { note: h.note } : {}),
    })),
    audience_age_lift: r.audience?.skew?.age, taste_tags: tags,
    programming: Object.fromEntries(Object.entries(r.programming || {}).map(([k, v]) => [k, (v || []).map(e => e.name)])),
    regulars: (r.story?.regulars || []).map(p => ({ name: p.name, portrait: p.portrait })), opening_night: r.story?.opening_night,
    brief: { headline: r.brief?.headline, opening_week: r.brief?.opening_week, collabs: r.brief?.collabs, risks: r.brief?.risks },
    weights: FIT_WEIGHTS,
  };
}

const ROUTER_PROMPT = `You route follow-up questions about a TasteRouter report. Decide if ONE tool would help, then return ONLY JSON.
Tools:
- {"tool":"rescore","weights":{"taste":0-1,"overlap":0-1,"space":0-1}}  re-rank the neighbourhoods with different Taste-Fit weights (taste depth, audience overlap, white space). Use for "I care more about low competition", "ignore competition", "what if taste matters most".
- {"tool":"venues","tag_query":"one or two words, e.g. inexpensive, cheap eats, late night, outdoor seating, vegan, live music"}  look up taste-matched venues carrying that Qloo tag around each scouted area. Use for budget/price questions ("smaller budget" -> "inexpensive"), or questions about a kind of venue nearby.
- {"tool":"none"}  everything needed is already in the evidence (comparisons, explanations, programming, risks).
Only scout reports (kind "scout") can use rescore or venues; tour reports always use "none".`;

const ANSWER_PROMPT = `You are TasteRouter, talking to a small independent founder (or artist) who is nervous about betting their savings on this. Be warm and direct, like a trusted friend who did the homework, and answer their follow-up question about the finished report.
Rules: use ONLY the evidence JSON and the tool result provided. Quote real numbers and names from them (Taste-Fit as e.g. "71/100"). Never invent venues, rents, prices, foot traffic or statistics. If the question needs data TasteRouter does not have (rent, leases, ticket sales), say so in one short clause and give the closest proxy in the evidence.
Answer in at most 110 words, plain text, no markdown headings; short bullet lines starting with "- " are fine. End with one concrete next step.`;

export async function askReport({ report, question, history = [] }, { llm, qloo, model } = {}) {
  if (!llm) throw new Error('Follow-up chat needs an LLM.');
  const r = report.result;
  const evidence = chatEvidence(r);
  const recent = history.slice(-3).map(h => ({ q: String(h.q || '').slice(0, 300), a: String(h.a || '').slice(0, 600) }));

  let plan = { tool: 'none' };
  if (evidence.kind === 'scout') {
    const p = parseJSON(await llm.chat([{ role: 'system', content: ROUTER_PROMPT }, { role: 'user', content: `Question: ${question}\nReport: ${evidence.concept} in ${evidence.city}; neighbourhoods: ${evidence.neighborhoods.map(n => n.name).join(', ')}` }], { maxTokens: 120, temperature: 0 }).catch(() => ''));
    if (p?.tool === 'rescore' || p?.tool === 'venues') plan = p;
  }

  let tool = null, calls = 0;
  if (plan.tool === 'rescore') {
    const w = { taste: +plan.weights?.taste || 0, overlap: +plan.weights?.overlap || 0, space: +plan.weights?.space || 0 };
    if (w.taste + w.overlap + w.space > 0) {
      const sum = w.taste + w.overlap + w.space;
      const rows = r.neighborhoods.filter(h => h.fit_parts).map(h => ({ name: h.neighborhood, before: h.fit, after: tasteFit(h.fit_parts, w) }))
        .sort((a, b) => b.after - a.after).map((x, i) => ({ ...x, new_rank: i + 1, verdict: verdictFor(x.after).word }));
      tool = { name: 'rescore', weights: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, +(v / sum).toFixed(2)])), rows, summary: `Re-scored with weights ${Object.entries(w).map(([k, v]) => `${k} ${Math.round((v / sum) * 100)}%`).join(', ')}` };
    }
  } else if (plan.tool === 'venues' && qloo && plan.tag_query) {
    const q = String(plan.tag_query).slice(0, 40);
    const tags = await qloo.tags(q, { take: 5 }).catch(() => null); calls++;
    const tag = (tags?.results?.tags || []).find(t => /:place:/.test(t.id || '')) || tags?.results?.tags?.[0];
    if (tag) {
      const ids = r.seeds.resolved.map(s => s.id);
      const hoods = r.neighborhoods.slice(0, MAX_ASK_QLOO_CALLS - 1);
      const rows = await Promise.all(hoods.map(async h => {
        const res = await qloo.insights({ 'filter.type': 'urn:entity:place', 'filter.location': `POINT(${h.lon.toFixed(5)} ${h.lat.toFixed(5)})`, 'filter.location.radius': 900, 'filter.tags': tag.id, 'signal.interests.entities': ids, take: 10 }).catch(() => null);
        calls++;
        const ents = res?.results?.entities || [];
        return { name: h.neighborhood, count: ents.length, venues: ents.slice(0, 4).map(e => `${e.name} (affinity ${Math.round((e.query?.affinity || 0) * 100)})`) };
      }));
      tool = { name: 'venues', tag: tag.name, tag_id: tag.id, rows, summary: `Qloo: taste-matched "${tag.name}" venues within 900 m of each area` };
    }
  }

  const answer = await llm.chat([
    { role: 'system', content: ANSWER_PROMPT },
    { role: 'user', content: JSON.stringify({ evidence, tool_result: tool, recent_conversation: recent, question }) },
  ], { maxTokens: 320, temperature: 0.3, ...(model ? { model } : {}) }).catch(e => (model ? llm.chat([{ role: 'system', content: ANSWER_PROMPT }, { role: 'user', content: JSON.stringify({ evidence, tool_result: tool, recent_conversation: recent, question }) }], { maxTokens: 320, temperature: 0.3 }) : Promise.reject(e)));
  return { answer: String(answer || '').trim(), tool, qloo_calls: calls };
}
