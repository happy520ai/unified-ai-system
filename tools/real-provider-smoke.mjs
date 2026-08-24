#!/usr/bin/env node
/**
 * Credential-gated real-provider smoke wrapper for CI and operators.
 *
 * Runs the OpenAI route smoke (apps/.../src/entrypoints/smokeOpenAiRoute.js)
 * in real-with-key mode, enforces a hard timeout, and maps the JSON report to
 * a process exit code so a workflow can gate on it.
 *
 * Budget guardrails: one provider call per invocation, no retries, and the
 * run is skipped (exit 0) whenever OPENAI_API_KEY is absent — a missing
 * secret must never look like a pass or a regression.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const smokeEntry = join(repoRoot, "apps", "ai-gateway-service", "src", "entrypoints", "smokeOpenAiRoute.js");
const DEFAULT_TIMEOUT_MS = 180_000;

function emit(report) {
  console.log(JSON.stringify(report, null, 2));
}

function readPositiveIntEnv(name, fallback) {
  const parsed = Math.floor(Number(process.env[name]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSmokeReport(stdout) {
  // The entrypoint prints pino log lines (single-line JSON) followed by the
  // pretty-printed report. The report starts with a bare "{" line, so parse
  // from the last bare-brace line to the end of output.
  const lines = stdout.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index] !== "{") continue;
    const candidate = lines.slice(index).join("\n");
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.checks)) {
        return parsed;
      }
    } catch {
      // Keep scanning backwards.
    }
  }
  return null;
}

async function runSmoke() {
  const timeoutMs = readPositiveIntEnv("REAL_PROVIDER_SMOKE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  // Real provider modes require enterprise authentication even on loopback.
  // Provision a per-run random bootstrap token; the value never leaves the
  // child environment and is never printed.
  const runToken = randomBytes(32).toString("hex");
  const auditCheckpointKey = randomBytes(32).toString("hex");
  const isolatedStateRoot = await mkdtemp(join(tmpdir(), "uai-real-provider-smoke-"));
  const child = spawn(process.execPath, [smokeEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AI_GATEWAY_SMOKE_MODE: "real-with-key",
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      // Pin the lane to OpenAI so the smoke cannot drift to another provider
      // or fall back to the fake lane and still report success.
      AI_GATEWAY_ENABLED_PROVIDERS: "openai,local-fake-provider",
      AI_GATEWAY_DEFAULT_PROVIDER: "openai",
      ...(process.env.OPENAI_MODEL
        ? { AI_GATEWAY_DEFAULT_MODEL: process.env.OPENAI_MODEL }
        : {}),
      PME_AUTH_TOKEN: runToken,
      PME_AUTH_TENANT_ID: "real-provider-smoke",
      PME_AUDIT_LOG_PATH: join(isolatedStateRoot, "enterprise-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(isolatedStateRoot, "enterprise-audit.chain.jsonl"),
      PME_AUDIT_CHECKPOINT_PATH: join(isolatedStateRoot, "enterprise-audit.checkpoint.json"),
      PME_AUDIT_CHECKPOINT_HMAC_KEY: auditCheckpointKey,
      AI_GATEWAY_USAGE_LOG_DIR: join(isolatedStateRoot, "usage"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeoutMs);
  timer.unref?.();

  const exitCode = await new Promise((resolve) => {
    child.once("error", (error) => {
      stderr += `\nspawn failed: ${error?.message ?? error}`;
      resolve(-1);
    });
    child.once("close", (code) => resolve(code ?? -1));
  });
  clearTimeout(timer);
  await rm(isolatedStateRoot, { recursive: true, force: true });

  return { exitCode, stdout, stderr, timedOut: exitCode === -1 && !stderr.includes("spawn failed") };
}

function evaluate(report) {
  const failures = [];
  for (const check of report.checks ?? []) {
    if (check?.skipped === true) {
      failures.push({ name: check.name, reason: check.reason ?? "skipped" });
      continue;
    }
    if (check?.result?.success !== true) {
      failures.push({
        name: check.name,
        code: check.result?.error?.code ?? check.result?.code ?? "unknown",
      });
      continue;
    }
    // A fake-lane fallback must never count as a real-provider pass.
    if (check.result?.data?.executionMode !== "real") {
      failures.push({
        name: check.name,
        code: "real_provider_smoke_fell_back_to_fake",
        executionMode: check.result?.data?.executionMode ?? null,
      });
    }
  }
  return failures;
}

const hasKey = Boolean(process.env.OPENAI_API_KEY);
if (!hasKey) {
  emit({
    wrapper: "real-provider-smoke",
    skipped: true,
    reason: "OPENAI_API_KEY is not configured; skipping the real-provider smoke.",
    realProviderCallMade: false,
  });
  process.exit(0);
}

const { exitCode, stdout, stderr, timedOut } = await runSmoke();
const report = parseSmokeReport(stdout);
if (!report) {
  emit({
    wrapper: "real-provider-smoke",
    ok: false,
    timedOut,
    childExitCode: exitCode,
    reason: "The smoke entrypoint did not produce a parseable JSON report.",
    stderrTail: stderr.slice(-500),
    realProviderCallMade: true,
  });
  process.exit(1);
}

const failures = evaluate(report);
emit({
  wrapper: "real-provider-smoke",
  ok: failures.length === 0,
  timedOut,
  childExitCode: exitCode,
  smokeMode: report.mode,
  checks: (report.checks ?? []).map((check) => ({
    name: check.name,
    skipped: check.skipped === true,
    success: check.skipped === true ? null : check.result?.success === true,
  })),
  failures,
  realProviderCallMade: true,
});
process.exit(failures.length === 0 ? 0 : 1);
