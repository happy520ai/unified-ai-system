const EXAMPLES = [
  { label: '🎧 Vinyl wine bar · NYC', brief: 'A tiny vinyl listening bar with natural wine in New York, for people who love Khruangbin, Wong Kar-wai films and Aesop-style minimal design.' },
  { label: '🍜 Ghibli ramen pop-up · London', brief: 'A plant-based ramen pop-up in London for fans of Studio Ghibli, Tame Impala and Muji.' },
  { label: '📚 Bookshop café · Chicago', brief: 'An indie bookshop café in Chicago for people who love Phoebe Bridgers, Sally Rooney novels and Patagonia.' },
  { label: '🎤 Secret gig · Los Angeles', brief: 'Where should an indie artist like Mitski play an intimate secret show in Los Angeles? Small music venue, fans also love A24 films and Japanese Breakfast.' },
];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let map, layers = [], lastResult = null, calls = 0;

const ex = $('examples');
for (const e of EXAMPLES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = e.label; b.onclick = () => { $('brief').value = e.brief; run(); }; ex.append(b); }
$('form').onsubmit = ev => { ev.preventDefault(); run(); };
$('again').onclick = () => { $('brief').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
$('copy').onclick = () => { if (lastResult) navigator.clipboard.writeText(toMarkdown(lastResult)).then(() => { $('copy').textContent = 'Copied ✓'; setTimeout(() => $('copy').textContent = 'Copy brief as Markdown', 1500); }); };
const qp = new URLSearchParams(location.search).get('q'); if (qp) { $('brief').value = qp; setTimeout(run, 50); }

function ensureMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([40.72, -73.95], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap contributors © CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
}
function clearMap() { layers.forEach(l => l.remove()); layers = []; }

async function run() {
  const brief = $('brief').value.trim();
  if (brief.length < 12) { $('brief').focus(); return; }
  $('go').disabled = true; $('go').textContent = 'Scouting…';
  $('run').classList.remove('hidden'); $('result').classList.add('hidden'); $('err').classList.add('hidden');
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
  else if (ev.type === 'note') { const li = document.createElement('li'); li.className = 'done'; li.innerHTML = `<span class="s">${esc(ev.text)}</span>`; $('steps').append(li); }
  else if (ev.type === 'result') render(ev.result);
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
      .bindPopup(`<b>${esc(h.neighborhood || 'Hotspot')}</b><br>Opportunity ${Math.round(h.opportunity * 100)} · ${esc(h.label)}`).addTo(map);
    layers.push(m); pts.push([h.lat, h.lon]);
  });
  if (r.neighborhoods.length) map.fitBounds(L.latLngBounds(r.neighborhoods.map(h => [h.lat, h.lon])).pad(0.8));

  $('r-kicker').textContent = `${r.plan.concept} · ${r.plan.city}`;
  $('r-headline').textContent = b.headline || '';
  $('r-position').textContent = b.positioning || '';

  $('r-hoods').innerHTML = r.neighborhoods.map((h, i) => `
    <div class="card hood ${i ? '' : 'first'}">
      <div class="t"><h4>${i + 1}. ${esc(h.neighborhood || 'Unnamed hotspot')}</h4><div class="score">${Math.round(h.opportunity * 100)}<small>/100</small></div></div>
      <div class="bar"><i style="width:${Math.round(h.opportunity * 100)}%"></i></div>
      <div><span class="pill ${h.label === 'white space' ? 'green' : h.label.includes('crowded') ? '' : 'grey'}">${esc(h.label)}</span> <span class="muted small">${h.competitor_count ?? '?'} ${esc(r.concept.category?.name || 'similar')} venues within 900 m · taste peak ${Math.round(h.peak * 100)}</span></div>
      ${i === 0 && b.pick?.why ? `<ul>${b.pick.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      ${i === 1 && b.runner_up?.why ? `<p class="small">${esc(b.runner_up.why)}</p>` : ''}
      <div class="small"><b>Taste-matched anchors</b><ul>${h.anchors.slice(0, 4).map(a => `<li>${esc(a.name)} <span class="tags">${esc(a.tags.join(' · '))}</span></li>`).join('')}</ul></div>
    </div>`).join('');

  const age = r.audience.skew?.age || {};
  const maxAbs = Math.max(0.01, ...Object.values(age).map(Math.abs));
  $('r-aud').innerHTML = `<div class="aud">${Object.entries(age).map(([k, v]) => `<span>${esc(k.replaceAll('_', ' '))}</span><span class="b"><i style="left:${v < 0 ? 50 - (Math.abs(v) / maxAbs) * 50 : 50}%;width:${(Math.abs(v) / maxAbs) * 50}%;background:${v < 0 ? '#cfc5b8' : '#1f6f5c'}"></i></span><span class="small">${v > 0 ? '+' : ''}${Math.round(v * 100)}%</span>`).join('')}</div>`;
  const g = r.dna.groups || {};
  $('r-dna').innerHTML = [...(g.vibe || []).map(t => `<span class="tag">${esc(t.name)}</span>`), ...(g.menu || []).map(t => `<span class="tag menu">${esc(t.name)}</span>`)].join('');

  $('r-week').innerHTML = (b.opening_week || []).map(w => `<li><b>${esc(w.night)}</b><span>${esc(w.idea)}</span></li>`).join('');
  $('r-collabs').innerHTML = (b.collabs || []).map(c => `<li>${esc(c)}</li>`).join('');
  $('r-menu').innerHTML = (b.menu_and_vibe || []).map(c => `<li>${esc(c)}</li>`).join('');
  $('r-risks').innerHTML = (b.risks || []).map(c => `<li>${esc(c)}</li>`).join('');

  const P = r.programming || {};
  const sec = (t, arr) => arr?.length ? `<div><h5>${t}</h5>${arr.slice(0, 4).map(e => `<div class="ent">${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : ''}<span>${esc(e.name)}</span></div>`).join('')}</div>` : '';
  $('r-prog').innerHTML = sec('Play', P.artists) + sec('Screen', P.films) + sec('Collab brands', P.brands) + sec('Stock / book club', P.books);

  $('r-baseline').textContent = r.baseline || 'Baseline comparison runs for free-text briefs.';
  $('r-grounded').textContent = `${b.headline || ''}\n\nBacked by ${r.heatmap.cell_count} Qloo heatmap cells, ${r.neighborhoods.reduce((s, h) => s + h.anchors.length, 0)} taste-matched venues and a live competitor count per block.`;
  $('r-meta').textContent = `Generated ${new Date(r.meta.generated_at).toLocaleString()} · ${(r.meta.ms / 1000).toFixed(1)}s · planner/writer: ${r.meta.llm || 'deterministic'} · data: Qloo Taste AI`;
  $('result').classList.remove('hidden');
}

function toMarkdown(r) {
  const b = r.brief;
  return [`# ${b.headline}`, '', `**Concept:** ${r.plan.concept} · **City:** ${r.plan.city}`, '', b.positioning, '', '## Ranked neighbourhoods',
    ...r.neighborhoods.map((h, i) => `${i + 1}. **${h.neighborhood}** — opportunity ${Math.round(h.opportunity * 100)}/100 (${h.label}, ${h.competitor_count ?? '?'} competitors nearby). Anchors: ${h.anchors.map(a => a.name).join(', ')}`),
    '', '## Opening week', ...(b.opening_week || []).map(w => `- **${w.night}:** ${w.idea}`), '', '## Collabs', ...(b.collabs || []).map(c => `- ${c}`),
    '', '## Risks', ...(b.risks || []).map(c => `- ${c}`), '', '_Generated by TasteRouter · data: Qloo Taste AI_'].join('\n');
}
