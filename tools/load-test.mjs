#!/usr/bin/env node
// =============================================================================
// load-test.mjs — 负载测试框架（零依赖，使用原生 HTTP）
// 用法: node tools/load-test.mjs [--url URL] [--concurrency N] [--duration S]
// =============================================================================

import http from "node:http";

// ── 配置 ──
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};

const config = {
  url: getArg("url", "http://127.0.0.1:3100/health/check"),
  method: getArg("method", "GET").toUpperCase(),
  concurrency: parseInt(getArg("concurrency", "10"), 10),
  durationSec: parseInt(getArg("duration", "10"), 10),
  body: getArg("body", null),
};

console.log(`
╔══════════════════════════════════════════════════╗
║           AI Gateway 负载测试                    ║
╠══════════════════════════════════════════════════╣
║ 目标: ${config.url.padEnd(40)}║
║ 方法: ${config.method.padEnd(40)}║
║ 并发: ${String(config.concurrency).padEnd(40)}║
║ 时长: ${(config.durationSec + "s").padEnd(40)}║
╚══════════════════════════════════════════════════╝
`);

// ── 统计 ──
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatencyMs: 0,
  minLatencyMs: Infinity,
  maxLatencyMs: 0,
  latencies: [],
  errors: {},
  statusCodes: {},
  startTime: null,
  endTime: null,
};

// ── 单次请求 ──
function makeRequest() {
  return new Promise((resolve) => {
    const startMs = Date.now();
    const url = new URL(config.url);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: config.method,
      headers: {
        "content-type": "application/json",
        "user-agent": "ai-gateway-load-test/1.0",
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        const latencyMs = Date.now() - startMs;
        stats.totalRequests++;
        stats.totalLatencyMs += latencyMs;
        stats.minLatencyMs = Math.min(stats.minLatencyMs, latencyMs);
        stats.maxLatencyMs = Math.max(stats.maxLatencyMs, latencyMs);
        stats.latencies.push(latencyMs);

        const code = res.statusCode;
        stats.statusCodes[code] = (stats.statusCodes[code] ?? 0) + 1;

        if (code >= 200 && code < 400) {
          stats.successfulRequests++;
        } else {
          stats.failedRequests++;
        }
        resolve();
      });
    });

    req.on("error", (err) => {
      stats.totalRequests++;
      stats.failedRequests++;
      const errCode = err.code ?? "UNKNOWN";
      stats.errors[errCode] = (stats.errors[errCode] ?? 0) + 1;
      stats.latencies.push(Date.now() - startMs);
      resolve();
    });

    req.on("timeout", () => {
      req.destroy();
      stats.totalRequests++;
      stats.failedRequests++;
      stats.errors.TIMEOUT = (stats.errors.TIMEOUT ?? 0) + 1;
      resolve();
    });

    if (config.body) {
      req.write(config.body);
    }
    req.end();
  });
}

// ── 并发执行器 ──
async function runLoadTest() {
  stats.startTime = Date.now();
  const endTimeMs = stats.startTime + config.durationSec * 1000;

  const workers = [];
  for (let i = 0; i < config.concurrency; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTimeMs) {
          await makeRequest();
        }
      })()
    );
  }

  await Promise.all(workers);
  stats.endTime = Date.now();

  // ── 计算百分位 ──
  stats.latencies.sort((a, b) => a - b);
  const len = stats.latencies.length;
  const p50 = stats.latencies[Math.floor(len * 0.5)] ?? 0;
  const p90 = stats.latencies[Math.floor(len * 0.9)] ?? 0;
  const p95 = stats.latencies[Math.floor(len * 0.95)] ?? 0;
  const p99 = stats.latencies[Math.floor(len * 0.99)] ?? 0;
  const avg = len > 0 ? Math.round(stats.totalLatencyMs / len) : 0;
  const actualDurationSec = (stats.endTime - stats.startTime) / 1000;
  const rps = Math.round(stats.totalRequests / actualDurationSec);
  const successRate = stats.totalRequests > 0
    ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)
    : "0.00";

  // ── 输出报告 ──
  console.log(`
╔══════════════════════════════════════════════════╗
║              负载测试报告                        ║
╠══════════════════════════════════════════════════╣
║ 总请求数:     ${String(stats.totalRequests).padEnd(33)}║
║ 成功请求:     ${String(stats.successfulRequests).padEnd(33)}║
║ 失败请求:     ${String(stats.failedRequests).padEnd(33)}║
║ 成功率:       ${(successRate + "%").padEnd(33)}║
║ 吞吐量:       ${(rps + " req/s").padEnd(33)}║
║ 实际时长:     ${(actualDurationSec.toFixed(1) + "s").padEnd(33)}║
╠══════════════════════════════════════════════════╣
║              延迟分布                            ║
╠══════════════════════════════════════════════════╣
║ 平均:         ${(avg + "ms").padEnd(33)}║
║ P50:          ${(p50 + "ms").padEnd(33)}║
║ P90:          ${(p90 + "ms").padEnd(33)}║
║ P95:          ${(p95 + "ms").padEnd(33)}║
║ P99:          ${(p99 + "ms").padEnd(33)}║
║ 最小:         ${(stats.minLatencyMs + "ms").padEnd(33)}║
║ 最大:         ${(stats.maxLatencyMs + "ms").padEnd(33)}║
╠══════════════════════════════════════════════════╣
║              状态码分布                          ║
╠══════════════════════════════════════════════════╣`);

  for (const [code, count] of Object.entries(stats.statusCodes).sort()) {
    console.log(`║ ${code}: ${String(count).padEnd(42)}║`);
  }

  if (Object.keys(stats.errors).length > 0) {
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║              错误分布                            ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    for (const [err, count] of Object.entries(stats.errors).sort()) {
      console.log(`║ ${err}: ${String(count).padEnd(39)}║`);
    }
  }

  console.log(`╚══════════════════════════════════════════════════╝`);

  // SLO 判断
  const sloMet = p99 < 10000 && parseFloat(successRate) > 95;
  console.log(`\n${sloMet ? "✅ SLO 达标" : "❌ SLO 未达标"} (P99 < 10s, 成功率 > 95%)\n`);

  // 退出码
  process.exitCode = sloMet ? 0 : 1;
}

runLoadTest().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
