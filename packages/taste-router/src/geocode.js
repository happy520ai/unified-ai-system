// City -> centre point + search radius, via OpenStreetMap Nominatim (free; cached; 1 req/s policy respected by caching).
import { haversineKm } from './geo.js';
export async function geocodeCity(city, { fetchImpl = fetch, store } = {}) {
  const key = `geo:${city.toLowerCase().trim()}`;
  if (store) { const hit = await store.get(key).catch(() => null); if (hit) return hit; }
  const res = await fetchImpl(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`, { headers: { 'user-agent': 'TasteRouter/1.0 (Qloo hackathon demo; github.com/happy520ai/taste-router)', 'accept-language': 'en' } });
  const [hit] = res.ok ? await res.json() : [];
  if (!hit) return null;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  const halfDiag = haversineKm({ lat: s, lon: w }, { lat: n, lon: e }) / 2;
  const out = { name: hit.display_name.split(',').slice(0, 2).join(','), lat: +hit.lat, lon: +hit.lon, radius_m: Math.round(Math.min(18, Math.max(5, halfDiag * 0.6)) * 1000) };
  if (store) await store.put(key, out).catch(() => {});
  return out;
}
