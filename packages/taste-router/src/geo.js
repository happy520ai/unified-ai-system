// Small geo helpers: distance and greedy clustering of Qloo heatmap cells into hotspots.
export function haversineKm(a, b) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Greedy clustering: walk cells from highest affinity, seed a cluster, absorb neighbours within radiusKm.
 * Cluster score rewards both peak affinity and how many strong cells sit together (a "scene", not a single block).
 */
export function clusterHeatmap(cells, { radiusKm = 1.2, maxClusters = 5, minAffinity = 0.5 } = {}) {
  const pts = cells
    .map(c => ({ lat: c.location.latitude, lon: c.location.longitude, geohash: c.location.geohash, affinity: c.query?.affinity ?? 0, popularity: c.query?.popularity ?? 0 }))
    .filter(p => p.affinity >= minAffinity)
    .sort((a, b) => b.affinity - a.affinity);
  const used = new Set();
  const clusters = [];
  for (let i = 0; i < pts.length && clusters.length < maxClusters; i++) {
    if (used.has(i)) continue;
    const members = [];
    for (let j = i; j < pts.length; j++) {
      if (used.has(j)) continue;
      if (haversineKm(pts[i], pts[j]) <= radiusKm) { used.add(j); members.push(pts[j]); }
    }
    const w = members.reduce((s, m) => s + m.affinity, 0);
    const lat = members.reduce((s, m) => s + m.lat * m.affinity, 0) / w;
    const lon = members.reduce((s, m) => s + m.lon * m.affinity, 0) / w;
    const peak = members[0].affinity;
    const density = Math.min(1, members.length / 6);
    clusters.push({ lat, lon, peak, cells: members.length, density, score: +(0.7 * peak + 0.3 * density).toFixed(4), geohash: members[0].geohash });
  }
  return clusters.sort((a, b) => b.score - a.score);
}
