#!/usr/bin/env node
/**
 * load-test.mjs — Load testing for AI Gateway
 * Usage: node tools/load-test.mjs [--concurrency=10] [--duration=30]
 */
const CONCURRENCY = Number(process.argv.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? 10);
const DURATION_SEC = Number(process.argv.find(a => a.startsWith("--duration="))?.split("=")[1] ?? 30);
const BASE_URL = process.argv.find(a => a.startsWith("--url="))?.split("=")[1] ?? "http://127.0.0.1:3100";

const ENDPOINTS = [
  { method: "GET", path: "/health/live", weight: 3 },
  { method: "GET", path: "/health/ready", weight: 2 },
  { method: "GET", path: "/providers", weight: 2 },
  { method: "POST", path: "/workforce/plan", weight: 1, body: { goal: "test load" } },
];

const stats = { total: 0, success: 0, errors: 0, latencies: [], statusCodes: {} };

async function sendRequest(ep) {
  const start = performance.now();
  try {
    const opts = { method: ep.method, headers: { "Content-Type": "application/json" } };
    if (ep.body) opts.body = JSON.stringify(ep.body);
    const res = await fetch(`${BASE_URL}${ep.path}`, opts);
    const latency = performance.now() - start;
    stats.total++; stats.latencies.push(latency);
    stats.statusCodes[res.status] = (stats.statusCodes[res.status] || 0) + 1;
    if (res.ok) stats.success++; else stats.errors++;
  } catch { stats.total++; stats.errors++; }
}

function pick() {
  const tw = ENDPOINTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * tw;
  for (const ep of ENDPOINTS) { r -= ep.weight; if (r <= 0) return ep; }
  return ENDPOINTS[0];
}

function pct(arr, p) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(s.length * p / 100) - 1)];
}

async function run() {
  console.log(`Load Test: ${CONCURRENCY} concurrent, ${DURATION_SEC}s, ${BASE_URL}`);
  const endTime = Date.now() + DURATION_SEC * 1000;
  await Promise.all(Array.from({ length: CONCURRENCY }, () =>
    (async () => { while (Date.now() < endTime) await sendRequest(pick()); })()
  ));
  const avg = stats.latencies.reduce((s, l) => s + l, 0) / stats.latencies.length || 0;
  console.log(`\nTotal: ${stats.total} | OK: ${stats.success} | Err: ${stats.errors} | RPS: ${(stats.total / DURATION_SEC).toFixed(1)}`);
  console.log(`p50: ${pct(stats.latencies, 50)?.toFixed(1)}ms | p95: ${pct(stats.latencies, 95)?.toFixed(1)}ms | p99: ${pct(stats.latencies, 99)?.toFixed(1)}ms`);
  console.log(`Status: ${JSON.stringify(stats.statusCodes)}`);
  const pass = stats.total > 0 && stats.errors / stats.total < 0.01;
  console.log(`\n${pass ? "PASS" : "FAIL"}: Error rate ${(stats.errors / (stats.total || 1) * 100).toFixed(2)}%`);
  process.exit(pass ? 0 : 1);
}
run().catch(console.error);
