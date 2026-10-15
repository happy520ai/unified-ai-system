const EXAMPLES = [
  { label: '🎧 Vinyl wine bar · NYC', brief: 'A tiny vinyl listening bar with natural wine in New York, for people who love Khruangbin, Wong Kar-wai films and Aesop-style minimal design.' },
  { label: '🍜 Ghibli ramen pop-up · London', brief: 'A plant-based ramen pop-up in London for fans of Studio Ghibli, Tame Impala and Muji.' },
  { label: '📚 Bookshop café · Chicago', brief: 'An indie bookshop café in Chicago for people who love Phoebe Bridgers, Sally Rooney novels and Patagonia.' },
  { label: '🎤 Secret gig · Los Angeles', brief: 'Where should an indie artist like Mitski play an intimate secret show in Los Angeles? Small music venue, fans also love A24 films and Japanese Breakfast.' },
];
const TOUR_EXAMPLES = [
  { label: '🎤 Mitski · North America + Europe', artist: 'Mitski', cities: 'New York, Los Angeles, Chicago, Toronto, London, Berlin' },
  { label: '🎸 Khruangbin · global', artist: 'Khruangbin', cities: 'Austin, Los Angeles, London, Berlin, Amsterdam, Melbourne' },
];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cap = s => { s = String(s ?? ''); return s.charAt(0).toUpperCase() + s.slice(1); };
const escC = s => esc(cap(s));
let map, layers = [], lastResult = null, calls = 0, currentId = null, chatHistory = [];

const ex = $('examples');
for (const e of EXAMPLES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = e.label; b.onclick = () => { $('brief').value = e.brief; run(); }; ex.append(b); }
$('form').onsubmit = ev => { ev.preventDefault(); run(); };
$('again').onclick = () => { history.replaceState(null, '', '/'); (mode === 'tour' ? $('artist') : $('brief')).focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
const flash = (id, txt) => { const b = $(id), old = b.textContent; b.textContent = txt; setTimeout(() => b.textContent = old, 1600); };
$('copy').onclick = () => { if (lastResult) navigator.clipboard.writeText(lastResult.route ? tourMarkdown(lastResult) : toMarkdown(lastResult)).then(() => flash('copy', 'Copied ✓')); };
const permalink = () => currentId ? `${location.origin}/r/${currentId}` : location.href;
$('share').onclick = () => navigator.clipboard.writeText(permalink()).then(() => flash('share', 'Link copied ✓'));
$('pdf').onclick = () => { $('print-url').textContent = permalink(); map?.invalidateSize(); setTimeout(() => window.print(), 150); };
const qp = new URLSearchParams(location.search).get('q'); if (qp) { $('brief').value = qp; setTimeout(run, 50); }

function ensureMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([40.72, -73.95], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, className: 'tiles' }).addTo(map);
}
function clearMap() { layers.forEach(l => l.remove()); layers = []; }

async function run() {
  const brief = $('brief').value.trim();
  if (brief.length < 12) { $('brief').focus(); return; }
  $('go').disabled = true; $('go').textContent = 'Scouting…';
  $('run').classList.remove('hidden'); $('result').classList.add('hidden'); $('tour').classList.add('hidden'); $('err').classList.add('hidden'); resetAfter();
  $('steps').innerHTML = ''; calls = 0; $('calls').textContent = '0 Qloo calls';
  ensureMap(); clearMap(); setTimeout(() => map.invalidateSize(), 50);
  $('run').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const res = await fetch('/api/scout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief }) });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(JSON.parse(line)); }
    }
  } catch (e) { showError(e.message); }
  $('go').disabled = false; $('go').textContent = 'Scout it →';
}

function handle(ev) {
  if (ev.type === 'step') {
    let li = document.querySelector(`#steps li[data-n="${ev.name}"]`);
    if (!li) { li = document.createElement('li'); li.dataset.n = ev.name; $('steps').append(li); }
    li.className = ev.status;
    li.innerHTML = `${ev.ms != null ? `<span class="ms">${(ev.ms / 1000).toFixed(1)}s</span>` : ''}${esc(ev.label)}${ev.summary || ev.error ? `<span class="s">${esc(ev.summary || ev.error)}</span>` : ''}`;
    li.scrollIntoView({ block: 'nearest' });
  } else if (ev.type === 'qloo_call') { calls++; $('calls').textContent = `${calls} Qloo call${calls > 1 ? 's' : ''}`; }
  else if (ev.type === 'cache') { $('calls').textContent = ev.calls ? `cached · ${ev.calls} Qloo calls` : 'cached replay'; $('calls').title = 'Replayed from cache: 0 new Qloo calls'; }
  else if (ev.type === 'note') { const li = document.createElement('li'); li.className = 'done'; li.innerHTML = `<span class="s">${esc(ev.text)}</span>`; $('steps').append(li); }
  else if (ev.type === 'result') (ev.result.route ? renderTour(ev.result) : render(ev.result));
  else if (ev.type === 'report') setReport(ev.id);
  else if (ev.type === 'error') showError(ev.error);
}

function showError(msg) { $('err').textContent = `The agent hit a wall: ${msg}`; $('err').classList.remove('hidden'); }

function render(r) {
  lastResult = r;
  const b = r.brief || {};
  // Map: heat cells + numbered hotspots
  clearMap();
  const pts = [];
  for (const [lat, lon, a] of r.heatmap.cells || []) {
    if (a < 0.55) continue;
    layers.push(L.circle([lat, lon], { radius: 260, stroke: false, fillColor: '#d9481c', fillOpacity: Math.max(0.05, (a - 0.5) * 0.5) }).addTo(map));
    pts.push([lat, lon]);
  }
  r.neighborhoods.forEach((h, i) => {
    const m = L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html: `<div class="hood-pin ${i ? '' : 'first'}">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup(`<b>${esc(h.neighborhood || 'Hotspot')}</b><br>Taste-Fit ${fitOf(h)}/100 · ${esc(h.label)}`).addTo(map);
    layers.push(m); pts.push([h.lat, h.lon]);
  });
  if (r.neighborhoods.length) map.fitBounds(L.latLngBounds(r.neighborhoods.map(h => [h.lat, h.lon])).pad(0.8));

  $('r-kicker').textContent = `${r.plan.concept} · ${r.plan.city}`;
  $('r-headline').textContent = b.headline || '';
  $('r-position').textContent = cap(b.positioning || '');

  $('r-verdict').innerHTML = r.verdict ? verdictHTML({ kicker: `Taste-Fit Score · top pick for ${r.plan.concept}`, name: r.verdict.neighborhood, fit: r.verdict.fit, verdict: r.verdict.verdict, advice: r.verdict.advice, line: r.verdict.line, lead: r.verdict.lead, runner: r.verdict.runner_up, parts: r.verdict.parts, foot: `Confidence ${r.verdict.confidence} · based on ${r.verdict.basis}` }) : '';
  $('r-verdict').classList.toggle('hidden', !r.verdict);
  renderPeople(r);
  $('r-hoods').innerHTML = r.neighborhoods.map((h, i) => `
    <div class="card hood ${i ? '' : 'first'}">
      <div class="t"><h4>${i + 1}. ${esc(h.neighborhood || 'Unnamed hotspot')}</h4><div class="score" title="Taste-Fit Score">${fitOf(h)}<small>/100</small></div></div>
      <div class="bar"><i style="width:${fitOf(h)}%"></i></div>
      ${h.fit_parts ? partsHTML(h.fit_parts, true) : ''}
      <div>${h.verdict ? `<span class="pill ${vClass(h.verdict)}">${esc(h.verdict)}</span> ` : ''}<span class="pill ${h.label === 'white space' ? 'green' : h.label.includes('crowded') ? '' : 'grey'}">${esc(h.label)}</span> <span class="muted small">${h.competitor_count >= 50 ? '50+' : (h.competitor_count ?? '?')} ${esc(r.concept.category?.name || 'similar')} venues within 900 m · taste peak ${Math.round(h.peak * 100)}</span></div>
      ${i === 0 && b.pick?.why ? `<ul>${b.pick.why.map(w => `<li>${escC(w)}</li>`).join('')}</ul>` : ''}
      ${belongOf(r, h) ? `<p class="belong">${esc(belongOf(r, h))}</p>` : ''}
      ${i === 1 && b.runner_up?.why ? `<p class="small">${escC(b.runner_up.why)}</p>` : ''}
      ${h.note ? `<p class="small note">${esc(h.note)}</p>` : ''}
      <div class="small"><b>Taste-matched anchors</b><ul>${h.anchors.slice(0, 4).map(a => `<li>${esc(a.name)} <span class="tags">${esc(a.tags.join(' · '))}</span></li>`).join('')}</ul></div>
    </div>`).join('');

  const age = r.audience.skew?.age || {};
  const maxAbs = Math.max(0.01, ...Object.values(age).map(Math.abs));
  $('r-aud').innerHTML = `<div class="aud">${Object.entries(age).map(([k, v]) => `<span>${esc(k.replaceAll('_', ' '))}</span><span class="b"><i style="left:${v < 0 ? 50 - (Math.abs(v) / maxAbs) * 50 : 50}%;width:${(Math.abs(v) / maxAbs) * 50}%;background:${v < 0 ? '#cfc5b8' : '#1f6f5c'}"></i></span><span class="small">${v > 0 ? '+' : ''}${Math.round(v * 100)}%</span>`).join('')}</div>`;
  const g = r.dna.groups || {};
  $('r-dna').innerHTML = [...(g.vibe || []).map(t => `<span class="tag">${esc(t.name)}</span>`), ...(g.menu || []).map(t => `<span class="tag menu">${esc(t.name)}</span>`)].join('');

  $('r-week').innerHTML = (b.opening_week || []).map(w => `<li><b>${esc(w.night)}</b><span>${escC(w.idea)}</span></li>`).join('');
  $('r-collabs').innerHTML = (b.collabs || []).map(c => `<li>${escC(c)}</li>`).join('');
  $('r-menu').innerHTML = (b.menu_and_vibe || []).map(c => `<li>${escC(c)}</li>`).join('');
  $('r-risks').innerHTML = (b.risks || []).map(c => `<li>${escC(c)}</li>`).join('');

  const P = r.programming || {};
  const sec = (t, arr) => arr?.length ? `<div><h5>${t}</h5>${arr.slice(0, 4).map(e => `<div class="ent">${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : ''}<span>${esc(e.name)}</span></div>`).join('')}</div>` : '';
  $('r-prog').innerHTML = sec('Play', P.artists) + sec('Screen', P.films) + sec('Collab brands', P.brands) + sec('Stock / book club', P.books);

  $('r-baseline').textContent = r.baseline || 'Baseline comparison runs for free-text briefs.';
  const top = r.neighborhoods[0], cat = r.concept.category?.name || 'similar';
  const fmtC = c => c == null ? '?' : c >= 50 ? '50+' : c;
  const anchorsN = r.neighborhoods.reduce((s, h) => s + h.anchors.length, 0);
  $('r-grounded').innerHTML = `<b>${esc(b.headline || '')}</b>` + (top ? `<ul class="evid">
    <li><b>${r.heatmap.cell_count}</b> Qloo heatmap cells scored for this exact taste mix, clustered into ${r.neighborhoods.length} hotspots</li>
    <li><b>${esc(top.neighborhood || 'Top hotspot')}</b>: Taste-Fit ${fitOf(top)}/100, taste peak ${Math.round(top.peak * 100)}, ${fmtC(top.competitor_count)} ${esc(cat)} venues within 900 m</li>
    ${r.neighborhoods.slice(1).map(h => `<li>vs. ${esc(h.neighborhood || 'hotspot')}: Taste-Fit ${fitOf(h)}/100, ${fmtC(h.competitor_count)} competitors (${esc(h.label)})</li>`).join('')}
    <li><b>${anchorsN}</b> taste-matched anchor venues, e.g. ${top.anchors.slice(0, 2).map(a => esc(a.name)).join(', ')}</li>
    <li>Audience skew and taste DNA measured, not guessed</li></ul>` : '');
  $('r-meta').textContent = `Generated ${new Date(r.meta.generated_at).toLocaleString()} · ${(r.meta.ms / 1000).toFixed(1)}s · planner/writer: ${r.meta.llm || 'deterministic'} · data: Qloo Taste AI`;
  $('result').classList.remove('hidden');
  document.title = `TasteRouter · ${r.plan.concept} in ${r.plan.city}`;
  showAfter('scout');
}

function toMarkdown(r) {
  const b = r.brief;
  return [`# ${b.headline}`, '', `**Concept:** ${r.plan.concept} · **City:** ${r.plan.city}`, '', b.positioning, '', ...(r.story?.regulars?.length ? ['## Meet your regulars', ...r.story.regulars.map(p => `- **${p.name}** — ${p.portrait}`), '', '## Opening night', r.story.opening_night, ''] : []), '## Ranked neighbourhoods (Taste-Fit Score)',
    ...r.neighborhoods.map((h, i) => `${i + 1}. **${h.neighborhood}** — Taste-Fit ${fitOf(h)}/100${h.verdict ? `, ${h.verdict}` : ''} (${h.label}, ${h.competitor_count ?? '?'} competitors nearby). Anchors: ${h.anchors.map(a => a.name).join(', ')}`),
    '', '## Opening week', ...(b.opening_week || []).map(w => `- **${w.night}:** ${w.idea}`), '', '## Collabs', ...(b.collabs || []).map(c => `- ${c}`),
    '', '## Risks', ...(b.risks || []).map(c => `- ${c}`), '', `_Generated by TasteRouter · data: Qloo Taste AI · ${permalink()}_`].join('\n');
}

// ---------- Tour router mode ----------
let mode = 'scout';
function setMode(m) {
  mode = m;
  $('m-scout').classList.toggle('on', m === 'scout'); $('m-tour').classList.toggle('on', m === 'tour');
  $('form').classList.toggle('hidden', m !== 'scout'); $('tourform').classList.toggle('hidden', m !== 'tour');
}
$('m-scout').onclick = () => setMode('scout'); $('m-tour').onclick = () => setMode('tour');
for (const e of TOUR_EXAMPLES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = e.label; b.onclick = () => { $('artist').value = e.artist; $('cities').value = e.cities; runTour(); }; $('tour-examples').append(b); }
$('tourform').onsubmit = ev => { ev.preventDefault(); runTour(); };
if (new URLSearchParams(location.search).get('tour')) { setMode('tour'); $('artist').value = new URLSearchParams(location.search).get('tour'); $('cities').value = new URLSearchParams(location.search).get('cities') || ''; setTimeout(runTour, 50); }

async function runTour() {
  const artist = $('artist').value.trim();
  if (artist.length < 2) { $('artist').focus(); return; }
  const cities = $('cities').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  $('tourgo').disabled = true; $('tourgo').textContent = 'Routing…';
  $('run').classList.remove('hidden'); $('result').classList.add('hidden'); $('tour').classList.add('hidden'); $('err').classList.add('hidden'); resetAfter();
  $('steps').innerHTML = ''; calls = 0; $('calls').textContent = '0 Qloo calls';
  ensureMap(); clearMap(); setTimeout(() => map.invalidateSize(), 50);
  $('run').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const res = await fetch('/api/tour', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artist, cities, stops: +$('stops').value }) });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(JSON.parse(line)); }
    }
  } catch (e) { showError(e.message); }
  $('tourgo').disabled = false; $('tourgo').textContent = 'Route the tour →';
}

function renderTour(r) {
  clearMap();
  const stops = r.route.stops;
  const inRoute = new Set(stops.map(s => s.city));
  for (const c of r.cities) if (!inRoute.has(c.city)) layers.push(L.circleMarker([c.lat, c.lon], { radius: 7, color: '#8a8175', weight: 1, fillColor: '#cfc5b8', fillOpacity: 0.8 }).bindPopup(`<b>${esc(c.city)}</b><br>Taste fit ${Math.round(c.score * 100)}/100 · not on the route`).addTo(map));
  layers.push(L.polyline(stops.map(s => [s.lat, s.lon]), { color: '#1f6f5c', weight: 3, dashArray: '8 8', opacity: 0.85 }).addTo(map));
  stops.forEach((s, i) => {
    const c = r.cities.find(x => x.city === s.city);
    layers.push(L.marker([s.lat, s.lon], { icon: L.divIcon({ className: '', html: `<div class="stop-pin">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindPopup(`<b>${esc(s.city)}</b><br>Taste fit ${Math.round(c.score * 100)}/100 · rank ${s.rank}`).addTo(map));
  });
  map.fitBounds(L.latLngBounds(stops.map(s => [s.lat, s.lon])).pad(0.35));
  const n = r.note || {};
  $('t-kicker').textContent = `Tour router · ${r.seeds.resolved.map(s => s.name).join(', ')}`;
  $('t-headline').textContent = n.headline || '';
  $('t-tip').textContent = `Route: ${r.route.order.join(' → ')}. ${cap(n.routing_tip || '')}`;
  $('t-route').innerHTML = stops.map((s, i) => {
    const c = r.cities.find(x => x.city === s.city);
    return `<div class="card hood ${s.rank === 1 ? 'first' : ''}"><div class="t"><h4>${i + 1}. ${esc(s.city)}</h4><div class="score">${Math.round(c.score * 100)}<small>/100</small></div></div>
      <div class="bar"><i style="width:${Math.round(c.score * 100)}%"></i></div>
      <div><span class="pill ${s.rank === 1 ? 'green' : 'grey'}">market rank #${s.rank}</span> <span class="muted small">${c.neighborhood ? `hottest around ${esc(c.neighborhood)}` : ''}</span></div>
      <div class="small"><b>Venues where this audience already goes</b><ul>${c.anchors.slice(0, 4).map(a => `<li>${esc(a.name)} <span class="tags">${esc((a.tags || []).join(' · '))}</span></li>`).join('')}</ul></div></div>`;
  }).join('');
  $('t-rank').innerHTML = r.cities.map(c => `<div class="rank-row ${inRoute.has(c.city) ? '' : 'out'}"><span>${esc(c.city)}</span><span class="b"><i style="width:${Math.round(c.score * 100)}%"></i></span><span class="small">${Math.round(c.score * 100)}</span></div>`).join('');
  $('t-why').innerHTML = (n.why || []).map(w => `<li>${escC(w)}</li>`).join('');
  $('t-risks').innerHTML = (n.risks || []).map(w => `<li>${escC(w)}</li>`).join('');
  $('t-meta').textContent = `Route ${r.route.km.toLocaleString('en-US')} km vs ${r.route.rank_order_km.toLocaleString('en-US')} km in pure rank order · ${(r.meta.ms / 1000).toFixed(1)}s · writer: ${r.meta.llm || 'deterministic'} · data: Qloo Taste AI`;
  const top = r.cities[0], second = r.cities[1];
  const fn = r.fan_night;
  $('t-night').innerHTML = fn ? `<p class="kicker">An intimate fan night · ${esc(fn.city)}${fn.neighborhood ? `, ${esc(fn.neighborhood)}` : ''}</p>
    <div class="night-row">${fn.room?.image ? `<img src="${esc(fn.room.image)}" alt="" loading="lazy">` : ''}<div><p class="story">${esc(n.fan_night || '')}</p>
    <p class="small muted">${fn.room ? `Room: <b>${esc(fn.room.name)}</b>${fn.room.tags?.length ? ` (${esc(fn.room.tags.join(' · '))})` : ''}` : ''}${fn.openers?.length ? ` · Local openers Qloo suggests: ${fn.openers.map(o => `<b>${esc(o.name)}</b>`).join(', ')}` : ''}</p></div></div>` : '';
  $('t-night').classList.toggle('hidden', !fn || !n.fan_night);
  $('t-verdict').innerHTML = verdictHTML({ kicker: 'Taste-Fit Score · strongest market', name: top.city, fit: Math.round(top.score * 100), verdict: tourVerdict(Math.round(top.score * 100)), advice: top.neighborhood ? `Book the first date here; the audience clusters around ${top.neighborhood}.` : 'Book the first date here.', lead: second ? Math.round(top.score * 100) - Math.round(second.score * 100) : null, runner: second?.city, parts: null, foot: `Mean Qloo audience-overlap of the 5 most taste-matched venues around each city's hottest heatmap cluster · ${r.cities.length} cities compared` });
  lastResult = r;
  $('tour').classList.remove('hidden');
  document.title = `TasteRouter · tour for ${r.seeds.resolved.map(s => s.name).join(', ')}`;
  showAfter('tour');
}

function tourMarkdown(r) {
  const n = r.note || {};
  return [`# ${n.headline || 'Tour plan'}`, '', `**Artist:** ${r.seeds.resolved.map(s => s.name).join(', ')}`, '', `**Route:** ${r.route.order.join(' → ')} (${r.route.km.toLocaleString('en-US')} km vs ${r.route.rank_order_km.toLocaleString('en-US')} km in rank order)`, '', '## Markets by Taste-Fit',
    ...r.cities.map((c, i) => `${i + 1}. **${c.city}** — Taste-Fit ${Math.round(c.score * 100)}/100${c.neighborhood ? `, hottest around ${c.neighborhood}` : ''}. Venues: ${(c.anchors || []).slice(0, 3).map(a => a.name).join(', ')}`),
    '', '## Why', ...(n.why || []).map(w => `- ${w}`), '', '## Risks', ...(n.risks || []).map(w => `- ${w}`), '', `_Generated by TasteRouter · data: Qloo Taste AI · ${permalink()}_`].join('\n');
}

// ---------- Taste-Fit verdict ----------
function fitOf(h) { return h.fit ?? Math.round((h.opportunity || 0) * 100); }
function vClass(v) { return /are here/.test(v) ? 'green' : /visit/.test(v) ? '' : 'grey'; }
function tourVerdict(f) { return f >= 80 ? 'Your fans are here' : f >= 65 ? 'A warm room' : 'A harder room'; }
function partsHTML(p, mini) {
  const rows = [['Taste depth', p.taste, 'Qloo heatmap affinity within 1.5 km'], ['Audience overlap', p.overlap, 'Qloo affinity of the top taste-matched venues'], ['White space', p.space, '1 − category saturation within 900 m']];
  return `<div class="parts ${mini ? 'mini' : ''}">${rows.map(([k, v, t]) => `<span title="${t}">${k}${mini ? '' : ` <small>${t}</small>`}</span><span class="b"><i style="width:${Math.round(v * 100)}%"></i></span><span class="v">${Math.round(v * 100)}</span>`).join('')}</div>`;
}
function verdictHTML(v) {
  return `<div class="ring" style="--p:${v.fit}"><div><b>${v.fit}</b><small>/100</small></div></div>
    <div class="v-body"><p class="kicker">${esc(v.kicker)}</p><h2>${esc(v.name || 'Top pick')}</h2>
    ${v.line ? `<p class="v-warm">${esc(v.line)}</p>` : ''}
    <p class="v-line"><span class="pill big ${vClass(v.verdict)}">${esc(v.verdict)}</span> ${esc(v.advice)}${v.lead != null && v.runner ? ` <span class="muted">· ${v.lead > 0 ? `+${v.lead} pts ahead of` : 'level with'} ${esc(v.runner)}</span>` : ''}</p>
    ${v.parts ? partsHTML(v.parts) : ''}<p class="small muted">${esc(v.foot)}</p></div>`;
}

// ---------- Share link, saved reports, follow-up chat ----------
function resetAfter() { currentId = null; chatHistory = []; $('after').classList.add('hidden'); $('chat-log').innerHTML = ''; $('permalink').textContent = ''; }
function setReport(id) {
  currentId = id;
  if (location.pathname !== `/r/${id}`) history.replaceState(null, '', `/r/${id}`);
  $('permalink').innerHTML = `Permanent link to this report: <a href="/r/${esc(id)}">${esc(location.origin)}/r/${esc(id)}</a>`;
}
const CHIPS = {
  scout: ['What about a smaller budget?', 'Compare #1 and #2', 'I care most about low competition', 'Which venues should I partner with first?'],
  tour: ['Why is #1 ahead of #2?', 'Which city should open the tour?', 'What are the risks of this route?'],
};
function showAfter(kind) {
  $('after').classList.remove('hidden');
  $('chat-chips').innerHTML = '';
  for (const q of CHIPS[kind]) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = q; b.onclick = () => ask(q); $('chat-chips').append(b); }
  $('again').textContent = kind === 'tour' ? 'Plan another tour' : 'Scout another idea';
}
function bubble(cls, html) { const d = document.createElement('div'); d.className = `msg ${cls}`; d.innerHTML = html; $('chat-log').append(d); d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return d; }
function fmtAnswer(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => /^[-*•] /.test(l) ? `<li>${l.slice(2)}</li>` : `<p>${l}</p>`).join('').replace(/(<li>.*?<\/li>)+/gs, m => `<ul>${m}</ul>`); }
function toolNote(t, calls) {
  if (!t) return 'answered from the stored report · 0 new Qloo calls';
  if (t.name === 'rescore') return `re-scored Taste-Fit (${Object.entries(t.weights).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ')}) · 0 Qloo calls`;
  return `looked up “${esc(t.tag)}” venues with Qloo · ${calls} call${calls === 1 ? '' : 's'}`;
}
async function ask(q) {
  q = String(q || '').trim(); if (q.length < 3) return;
  if (!currentId) { bubble('bot err', 'This report has no saved id yet; run it again to ask follow-ups.'); return; }
  $('chat-q').value = ''; $('chat-go').disabled = true;
  bubble('me', esc(q));
  const wait = bubble('bot pending', '<span class="dots"><i></i><i></i><i></i></span>');
  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: currentId, question: q, history: chatHistory }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    wait.classList.remove('pending');
    let extra = '';
    if (out.tool?.name === 'rescore') extra = `<div class="tool">${out.tool.rows.map(x => `<span>${x.new_rank}. ${esc(x.name)}</span><span>${x.before} → <b>${x.after}</b></span>`).join('')}</div>`;
    if (out.tool?.name === 'venues') extra = `<div class="tool">${out.tool.rows.map(x => `<span>${esc(x.name)}</span><span><b>${x.count >= 10 ? '10+' : x.count}</b> ${esc(out.tool.tag)}${x.venues[0] ? ` · e.g. ${esc(x.venues[0].replace(/ \(affinity.*$/, ''))}` : ''}</span>`).join('')}</div>`;
    wait.innerHTML = `${fmtAnswer(out.answer)}${extra}<span class="src">${toolNote(out.tool, out.qloo_calls)}${out.cached ? ' · cached' : ''}</span>`;
    chatHistory.push({ q, a: out.answer }); chatHistory = chatHistory.slice(-3);
  } catch (e) { wait.classList.remove('pending'); wait.classList.add('err'); wait.textContent = `Could not answer: ${e.message}`; }
  $('chat-go').disabled = false;
}
$('chat-form').onsubmit = ev => { ev.preventDefault(); ask($('chat-q').value); };

async function loadReport(id) {
  $('run').classList.remove('hidden'); $('steps').innerHTML = ''; ensureMap(); setTimeout(() => map.invalidateSize(), 50);
  try {
    const res = await fetch(`/api/report/${id}`);
    const rep = await res.json();
    if (!res.ok) throw new Error(rep.error || `HTTP ${res.status}`);
    if (rep.kind === 'tour') { setMode('tour'); $('artist').value = rep.input.artist || ''; $('cities').value = (rep.input.cities || []).join(', '); }
    else $('brief').value = rep.input.brief || '';
    for (const ev of rep.events || []) handle({ ...ev, replay: true });
    handle({ type: 'note', text: `Saved report from ${new Date(rep.created).toLocaleDateString()} · replayed from storage, 0 new Qloo calls.` });
    $('calls').textContent = rep.calls ? `saved · ${rep.calls} Qloo calls` : 'saved report';
    handle({ type: 'result', result: rep.result });
    setReport(id);
    $('run').scrollIntoView({ block: 'start' });
  } catch (e) { showError(e.message); }
}
const rid = /^\/r\/([st][0-9a-f]{11})$/.exec(location.pathname); if (rid) loadReport(rid[1]);

// ---------- The human layer: regulars, opening night, belonging ----------
function belongOf(r, h) { return r.story?.belong?.find(b => b.neighborhood === h.neighborhood)?.line; }
function shelf(icon, label, e, sub) {
  if (!e) return '';
  const name = typeof e === 'string' ? e : e.name;
  const img = typeof e === 'object' && e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : `<span class="ic">${icon}</span>`;
  return `<li>${img}<span><small>${label}</small>${esc(name)}${sub ? ` <small>${esc(sub)}</small>` : ''}</span></li>`;
}
function renderPeople(r) {
  const st = r.story;
  $('r-people').classList.toggle('hidden', !st?.regulars?.length);
  if (!st?.regulars?.length) return;
  $('r-regulars').innerHTML = st.regulars.map((p, i) => {
    const k = p.kit || {};
    return `<div class="card regular">
      <div class="who"><span class="avatar a${i}">${esc((p.name || '?')[0])}</span><div><h4>${esc(p.name)}</h4>${k.age ? `<span class="pill grey" title="Qloo demographic lift for this audience">${esc(k.age.band)}${k.age.lift > 0 ? ` · +${k.age.lift}% over-index` : ''}</span>` : ''}</div></div>
      <p class="portrait">${esc(p.portrait)}</p>
      <p class="quote">“${esc(String(p.quote || '').replace(/^["“]|["”]$/g, ''))}”</p>
      <ul class="shelf">${shelf('♥', 'already loves', k.loves)}${shelf('♪', 'listens to', k.listens)}${shelf('▶', 'watches', k.watches)}${shelf('◆', 'wears / uses', k.wears)}${shelf('❡', 'reads', k.reads)}${shelf('✦', 'orders', k.eats)}${shelf('⌂', 'hangs out at', k.hangout, k.hangout?.neighborhood)}</ul>
    </div>`;
  }).join('');
  $('r-night').textContent = st.opening_night || '';
}
