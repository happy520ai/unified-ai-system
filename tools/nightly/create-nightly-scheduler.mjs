import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const phaseId = "NightlyTaskScheduler";
const evidenceDir = "apps/ai-gateway-service/evidence/nightly-scheduler";
const resultPath = path.join(evidenceDir, "result.json");

const NIGHTLY_TASKS = [
  {
    id: "model-hotspot-refresh",
    name: "Refresh Free Model Hotspot",
    command: "pnpm run:model-hotspot-fetch",
    schedule: "daily",
    time: "02:00",
    enabled: true,
  },
  {
    id: "multi-provider-smoke",
    name: "Multi-Provider Smoke Test",
    command: "pnpm run:multi-provider-smoke",
    schedule: "daily",
    time: "03:00",
    enabled: true,
  },
  {
    id: "system-health-check",
    name: "System Health Check",
    command: "pnpm health:phase12a",
    schedule: "hourly",
    enabled: true,
  },
  {
    id: "evidence-cleanup",
    name: "Evidence Cleanup (30 days)",
    command: "node tools/nightly/cleanup-old-evidence.mjs",
    schedule: "weekly",
    time: "Sunday 04:00",
    enabled: true,
  },
];

function buildWindowsTaskScript() {
  const lines = [
    "@echo off",
    "REM Windows Task Scheduler Registration Script",
    "REM Run this as Administrator to register nightly tasks",
    "",
    "echo Registering nightly tasks...",
    "",
  ];

  for (const task of NIGHTLY_TASKS) {
    if (!task.enabled) continue;
    lines.push(`echo Registering: ${task.name}`);
    lines.push(`schtasks /create /tn "UnifiedAI\\${task.id}" /tr "${task.command}" /sc ${task.schedule === "hourly" ? "hourly" : "daily"} /st ${task.time || "00:00"} /f`);
    lines.push("");
  }

  lines.push("echo Done!");
  lines.push("pause");
  return lines.join("\n");
}

function buildLauncherScript() {
  const lines = [
    "#!/usr/bin/env node",
    "import { spawnSync } from 'node:child_process';",
    "",
    "const tasks = [",
  ];

  for (const task of NIGHTLY_TASKS) {
    if (!task.enabled) continue;
    lines.push(`  { id: '${task.id}', name: '${task.name}', command: '${task.command}' },`);
  }

  lines.push("];");
  lines.push("");
  lines.push("console.log('[Nightly] Starting nightly task runner...');");
  lines.push("const results = [];");
  lines.push("");
  lines.push("for (const task of tasks) {");
  lines.push("  console.log(`[Nightly] Running: ${task.name}...`);");
  lines.push("  const result = spawnSync('cmd', ['/c', task.command], { stdio: 'inherit', shell: true });");
  lines.push("  results.push({ id: task.id, name: task.name, status: result.status === 0 ? 'pass' : 'fail', exitCode: result.status });");
  lines.push("}");
  lines.push("");
  lines.push("console.log('[Nightly] All tasks completed.');");
  lines.push("console.log(JSON.stringify(results, null, 2));");

  return lines.join("\n");
}

function buildResult() {
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const windowsScript = buildWindowsTaskScript();
  const launcherScript = buildLauncherScript();

  writeFileSync(path.join(evidenceDir, "register-tasks.bat"), windowsScript);
  writeFileSync(path.join(evidenceDir, "nightly-runner.mjs"), launcherScript);

  const result = {
    phase: phaseId,
    executedAt: new Date().toISOString(),
    tasks: NIGHTLY_TASKS,
    windowsScheduler: {
      registered: false,
      reason: "Requires administrator privileges",
      scriptPath: path.join(evidenceDir, "register-tasks.bat"),
      instruction: "Run register-tasks.bat as Administrator to enable nightly automation",
    },
    fallbackLauncher: {
      available: true,
      scriptPath: path.join(evidenceDir, "nightly-runner.mjs"),
      usage: "node apps/ai-gateway-service/evidence/nightly-scheduler/nightly-runner.mjs",
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
    },
  };

  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");
  return result;
}

console.log(`[${phaseId}] Creating nightly task scheduler...`);
const result = buildResult();
console.log(`[${phaseId}] Results written to ${resultPath}`);
console.log(`[${phaseId}] Tasks configured: ${result.tasks.length}`);
console.log(`[${phaseId}] Windows Scheduler: ${result.windowsScheduler.registered ? "Registered" : "Not registered"}`);
console.log(`[${phaseId}] Fallback Launcher: ${result.fallbackLauncher.available ? "Available" : "Not available"}`);
console.log("");
console.log("To enable nightly automation:");
console.log("  1. Run 'register-tasks.bat' as Administrator");
console.log("  2. Or use the fallback launcher manually:");
console.log(`     node ${result.fallbackLauncher.scriptPath}`);
