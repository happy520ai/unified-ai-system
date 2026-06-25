/**
 * Level 3: 多 Provider 故障转移测试
 *
 * 测试 provider 故障时的自动切换能力:
 *   1. 主 Provider 故意配置错误端点 → 应该失败
 *   2. FailoverProvider 包装器自动切换到备用真实 Provider
 *   3. Agentic loop 通过 failover 完成任务
 *   4. 主 Provider 间歇性失败 → 第1次失败,第2次成功
 *
 * 环境变量: NVIDIA_API_KEY (可选, 默认使用 MiMo V2.5 Pro)
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createAgentToolRegistry, buildTool, createInputSchema } from "../claude-code-patterns/agentToolRegistry.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// Config
// ============================================================

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? "";
const MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const MODEL_ID = process.env.MIMO_MODEL || "mimo-v2.5-pro";
const PROVIDER_ID = "mimo";
const TIMEOUT_MS = 60_000;

if (!NVIDIA_API_KEY) {
  console.error("[FATAL] API key not set.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const errors = [];
const timeline = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(`  [PASS] ${label}`); }
  else { failed++; errors.push(label); console.log(`  [FAIL] ${label}`); }
}

function section(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function logTimeline(event, detail = "") {
  const ts = new Date().toISOString().slice(11, 23);
  const entry = `[${ts}] ${event}${detail ? " — " + detail : ""}`;
  timeline.push(entry);
  console.log(`  ${entry}`);
}

// ============================================================
// FailoverProviderAdapter — wraps two providers with auto-failover
// ============================================================

class FailoverProviderAdapter {
  constructor(primary, fallback, options = {}) {
    this.primary = primary;
    this.fallback = fallback;
    this.failoverLog = [];
    this.maxRetries = options.maxRetries ?? 1;
    this.callCount = 0;
  }

  get isDryRun() { return false; }

  async generate(providerRequest) {
    this.callCount++;

    // Try primary first
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.primary.generate(providerRequest);
        this.failoverLog.push({ call: this.callCount, provider: "primary", attempt, status: "success" });
        return result;
      } catch (error) {
        this.failoverLog.push({
          call: this.callCount,
          provider: "primary",
          attempt,
          status: "failed",
          error: error?.code || error.message,
          retryable: error?.retryable ?? false,
        });

        if (!error?.retryable || attempt >= this.maxRetries) {
          // Primary failed and is not retryable (or we exhausted retries)
          break;
        }
      }
    }

    // Fallback
    try {
      const result = await this.fallback.generate(providerRequest);
      this.failoverLog.push({ call: this.callCount, provider: "fallback", status: "success" });
      return result;
    } catch (fallbackError) {
      this.failoverLog.push({
        call: this.callCount,
        provider: "fallback",
        status: "failed",
        error: fallbackError?.code || fallbackError.message,
      });
      throw fallbackError;
    }
  }

  async *generateStream(providerRequest) {
    // Simplified: just delegate to fallback for streaming
    yield* this.fallback.generateStream(providerRequest);
  }
}

// ============================================================
// IntermittentFailAdapter — fails N times then succeeds
// ============================================================

class IntermittentFailAdapter {
  constructor(realAdapter, failCount = 1) {
    this.real = realAdapter;
    this.failCount = failCount;
    this.callCount = 0;
    this.failLog = [];
  }

  get isDryRun() { return false; }

  async generate(providerRequest) {
    this.callCount++;
    if (this.callCount <= this.failCount) {
      const error = new Error(`Simulated provider failure (call ${this.callCount}/${this.failCount})`);
      error.code = "SIMULATED_FAILURE";
      error.type = "unknown";
      error.category = "provider";
      error.retryable = true;
      this.failLog.push({ call: this.callCount, status: "simulated_failure" });
      throw error;
    }
    this.failLog.push({ call: this.callCount, status: "success" });
    return this.real.generate(providerRequest);
  }

  async *generateStream(providerRequest) {
    yield* this.real.generateStream(providerRequest);
  }
}

// ============================================================
// Temp project setup
// ============================================================

const testDir = join(tmpdir(), `failover-e2e-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

const sampleFile = join(testDir, "config.json");
writeFileSync(sampleFile, JSON.stringify({
  name: "test-app",
  version: "1.0.0",
  features: ["auth", "logging"],
  port: 3000,
}, null, 2), "utf-8");

console.log(`[failover] Project dir: ${testDir}`);

// ============================================================
// Real provider (used as fallback)
// ============================================================

const realModelConfig = {
  providerId: PROVIDER_ID,
  modelId: MODEL_ID,
  providerType: "mimo",
  providerDisplayName: "MiMo",
  enabled: true,
  endpoint: MIMO_BASE_URL,
  apiKey: NVIDIA_API_KEY,
  dryRun: false,
};

const realProvider = new HttpLLMProviderAdapter(realModelConfig, { timeoutMs: TIMEOUT_MS });

// ============================================================
// Scenario 1: Broken Primary → Fallback to Real
// ============================================================

section("Scenario 1: 主 Provider 完全故障 → 自动切到备用");

const brokenProvider = new HttpLLMProviderAdapter(
  {
    providerId: "broken-primary",
    modelId: "nonexistent-model",
    endpoint: "https://invalid-endpoint-that-does-not-exist.example.com/v1",
    enabled: true,
    apiKey: "fake-key-12345",
    dryRun: false,
  },
  { timeoutMs: 5000 }
);

const failoverAdapter1 = new FailoverProviderAdapter(brokenProvider, realProvider);

const loop1 = createAgenticLoop({
  providerAdapter: failoverAdapter1,
  workingDirectory: testDir,
  maxIterations: 5,
  maxTokensPerTurn: 2048,
  tokenBudget: 30_000,
  systemPrompt: `You are a helpful assistant with file tools. Read files when asked.`,
});

logTimeline("scenario1_start", "Broken primary → fallback");
const s1Start = Date.now();
let result1;
try {
  result1 = await loop1.execute({
    goal: `Read the file ${sampleFile} and tell me the app name and version.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`s1_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const s1Ms = Date.now() - s1Start;
  logTimeline("scenario1_done", `${s1Ms}ms, status=${result1.status}`);

  assert(result1.status === "completed", `Status is 'completed' (got: ${result1.status})`);
  assert(typeof result1.finalAnswer === "string" && result1.finalAnswer.length > 10, "Has final answer via fallback");

  // Check failover log
  const primaryFailures = failoverAdapter1.failoverLog.filter((e) => e.provider === "primary" && e.status === "failed");
  const fallbackSuccesses = failoverAdapter1.failoverLog.filter((e) => e.provider === "fallback" && e.status === "success");
  assert(primaryFailures.length > 0, `Primary provider failed as expected (${primaryFailures.length} times)`);
  assert(fallbackSuccesses.length > 0, `Fallback provider succeeded (${fallbackSuccesses.length} times)`);

  console.log(`  [info] Failover log:`);
  for (const entry of failoverAdapter1.failoverLog) {
    console.log(`    call=${entry.call} provider=${entry.provider} status=${entry.status} ${entry.error || ""}`);
  }
  console.log(`  [info] Final answer: "${result1.finalAnswer.slice(0, 150)}"`);
} catch (err) {
  logTimeline("scenario1_crash", err.message);
  assert(false, `Scenario 1 crashed: ${err.message}`);
}

// ============================================================
// Scenario 2: Intermittent Primary → recovers on retry
// ============================================================

section("Scenario 2: 间歇性故障 → 重试后恢复");

const intermittentAdapter = new IntermittentFailAdapter(realProvider, 1); // Fail first call

const failoverAdapter2 = new FailoverProviderAdapter(
  intermittentAdapter,
  realProvider,
  { maxRetries: 1 }
);

const loop2 = createAgenticLoop({
  providerAdapter: failoverAdapter2,
  workingDirectory: testDir,
  maxIterations: 5,
  maxTokensPerTurn: 2048,
  tokenBudget: 30_000,
  systemPrompt: `You are a helpful assistant with file tools.`,
});

logTimeline("scenario2_start", "Intermittent failure → retry");
const s2Start = Date.now();
let result2;
try {
  result2 = await loop2.execute({
    goal: `Read the file ${sampleFile} and list all features.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`s2_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const s2Ms = Date.now() - s2Start;
  logTimeline("scenario2_done", `${s2Ms}ms, status=${result2.status}`);

  assert(result2.status === "completed", `Status is 'completed' (got: ${result2.status})`);

  // Check intermittent failure was logged and recovered
  const simFailures = intermittentAdapter.failLog.filter((e) => e.status === "simulated_failure");
  const simSuccesses = intermittentAdapter.failLog.filter((e) => e.status === "success");
  assert(simFailures.length >= 1, `Intermittent failures recorded (${simFailures.length})`);
  assert(simSuccesses.length >= 1, `Successful calls after recovery (${simSuccesses.length})`);

  console.log(`  [info] Intermittent adapter: ${simFailures.length} failures, ${simSuccesses.length} successes`);
  console.log(`  [info] Final answer: "${result2.finalAnswer.slice(0, 150)}"`);
} catch (err) {
  logTimeline("scenario2_crash", err.message);
  assert(false, `Scenario 2 crashed: ${err.message}`);
}

// ============================================================
// Scenario 3: Both providers fail → graceful error
// ============================================================

section("Scenario 3: 双 Provider 全部故障 → 优雅降级");

const brokenFallback = new HttpLLMProviderAdapter(
  {
    providerId: "broken-fallback",
    modelId: "nonexistent",
    endpoint: "https://another-invalid-endpoint.example.com/v1",
    enabled: true,
    apiKey: "fake-key-99999",
    dryRun: false,
  },
  { timeoutMs: 3000 }
);

const doubleFailAdapter = new FailoverProviderAdapter(brokenProvider, brokenFallback);

const loop3 = createAgenticLoop({
  providerAdapter: doubleFailAdapter,
  workingDirectory: testDir,
  maxIterations: 3,
  maxTokensPerTurn: 2048,
  tokenBudget: 10_000,
});

logTimeline("scenario3_start", "Both providers fail");
const s3Start = Date.now();
let result3;
try {
  result3 = await loop3.execute({
    goal: "Read the config file.",
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
  });
  const s3Ms = Date.now() - s3Start;
  logTimeline("scenario3_done", `${s3Ms}ms, status=${result3.status}`);

  assert(result3.status === "error", `Status is 'error' (got: ${result3.status})`);
  const errorTraces = result3.trace.filter((t) => t.type === "error");
  assert(errorTraces.length > 0, "Error trace recorded");
  console.log(`  [info] Loop handled double-failure gracefully in ${result3.durationMs}ms`);
} catch (err) {
  // It's acceptable for the loop to throw if both providers fail
  logTimeline("scenario3_thrown", err.message);
  assert(true, "Loop threw on double failure (acceptable — no silent failure)");
}

// ============================================================
// Cleanup & Summary
// ============================================================

function cleanup() {
  try {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

console.log("\n" + "═".repeat(60));
console.log(`  Level 3 Failover Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));
console.log("\n  Timeline:");
for (const entry of timeline) console.log(`    ${entry}`);
if (errors.length > 0) {
  console.log("\n  Failed tests:");
  for (const e of errors) console.log(`    ✗ ${e}`);
}

cleanup();
process.exit(failed > 0 ? 1 : 0);
