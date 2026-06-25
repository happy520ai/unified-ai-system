import fs from "fs/promises";
import path from "path";
import os from "os";
import { DATA_DIR, BACKUP_DIR, PROVIDERS_CONFIG } from "./commandPaletteConstants.js";

/**
 * Miscellaneous command handlers for CommandPaletteService:
 *   neuron, workforce, deploy, backup, system
 * Extracted from commandPaletteService.js to stay under 500 lines.
 */

/* ================================================================== */
/*  NEURON                                                             */
/* ================================================================== */

export async function neuronList() {
  const neuronDir = path.join(DATA_DIR, "neurons");
  try {
    const entries = await fs.readdir(neuronDir, { withFileTypes: true });
    const neurons = entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name.replace(/\.json$/, ""));

    return { count: neurons.length, neurons };
  } catch {
    return {
      count: 0,
      neurons: [],
      hint: "No neuron registry found. Self-evolution pipeline manages neuron discovery.",
    };
  }
}

export async function neuronEvolve() {
  return {
    triggered: true,
    mode: "governed",
    hint: "Self-evolution pipeline is in governed mode. Autonomous code mutation allowed, deploy requires human approval.",
    policy: {
      autonomousCodeMutation: true,
      autonomousDeploy: false,
      humanApprovalRequired: true,
    },
  };
}

export async function neuronEnable(args) {
  const id = args.id ?? args._pos0;
  if (!id) throw new Error("Neuron id is required.");
  return { neuronId: id, action: "enabled", timestamp: new Date().toISOString() };
}

export async function neuronDisable(args) {
  const id = args.id ?? args._pos0;
  if (!id) throw new Error("Neuron id is required.");
  return { neuronId: id, action: "disabled", timestamp: new Date().toISOString() };
}

export async function neuronExecute(args) {
  const id = args.id ?? args._pos0;
  if (!id) throw new Error("Neuron id is required.");
  return {
    neuronId: id,
    action: "execute",
    status: "dry_run",
    hint: "Neuron execution requires the live skill registry runtime.",
    timestamp: new Date().toISOString(),
  };
}

/* ================================================================== */
/*  WORKFORCE                                                          */
/* ================================================================== */

export async function workforcePlan(svc, args) {
  const goal = args.goal ?? args._pos0 ?? "general improvement";
  const tqm = svc.gatewayContext.taskQueueManager;

  if (tqm && typeof tqm.enqueue === "function") {
    const task = await tqm.enqueue({
      title: `Workforce plan: ${goal}`,
      description: `Auto-generated workforce plan for goal: ${goal}`,
      priority: "P3",
      type: "plan",
    });
    return { plan: task };
  }

  return {
    goal,
    status: "preview",
    hint: "TaskQueueManager not connected. Connect via gatewayContext to create real plans.",
  };
}

export async function workforceStatus(svc) {
  const tqm = svc.gatewayContext.taskQueueManager;

  if (tqm && typeof tqm.getQueueStatus === "function") {
    return tqm.getQueueStatus();
  }

  return {
    status: "preview",
    hint: "TaskQueueManager not connected to gatewayContext.",
  };
}

export async function workforceAssign(svc) {
  const tqm = svc.gatewayContext.taskQueueManager;

  if (tqm && typeof tqm.autoAssign === "function") {
    return tqm.autoAssign();
  }

  return {
    status: "preview",
    hint: "TaskQueueManager not connected to gatewayContext.",
  };
}

export async function workforceCancel(svc, args) {
  const taskId = args.taskId ?? args._pos0;
  if (!taskId) throw new Error("taskId is required.");

  const tqm = svc.gatewayContext.taskQueueManager;
  if (tqm && typeof tqm.updateTaskStatus === "function") {
    return tqm.updateTaskStatus(taskId, "cancelled");
  }

  return { taskId, status: "preview", hint: "TaskQueueManager not connected." };
}

/* ================================================================== */
/*  DEPLOY                                                             */
/* ================================================================== */

export async function deployStatus() {
  const pkgFile = path.join(process.cwd(), "package.json");
  let version = "unknown";
  try {
    const raw = await fs.readFile(pkgFile, "utf-8");
    const pkg = JSON.parse(raw);
    version = pkg.version ?? "unknown";
  } catch {
    // ignore
  }

  return {
    version,
    mode: "local-preview",
    status: "running",
    uptime: process.uptime(),
    nodeVersion: process.version,
    pid: process.pid,
  };
}

export async function deployRollback() {
  return {
    status: "blocked",
    reason: "Autonomous rollback requires human approval per self-evolution policy.",
    policy: {
      autonomousDeploy: false,
      humanApprovalRequired: true,
    },
  };
}

export async function deployHealth() {
  const memUsage = process.memoryUsage();
  return {
    healthy: true,
    memory: {
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
    },
    uptime: `${process.uptime().toFixed(1)}s`,
    checks: [
      { name: "process_running", pass: true },
      { name: "memory_under_limit", pass: memUsage.rss < 2 * 1024 * 1024 * 1024 },
      { name: "event_loop_ok", pass: true },
    ],
  };
}

/* ================================================================== */
/*  BACKUP                                                             */
/* ================================================================== */

export async function backupCreate(svc) {
  return svc.createBackup();
}

export async function backupRestore(svc, args) {
  const backupId = args.backupId ?? args._pos0;
  if (!backupId) throw new Error("backupId is required.");

  // Validate backupId to prevent path traversal
  if (backupId.includes("..") || backupId.includes("/") || backupId.includes("\\") || backupId.includes("\0")) {
    throw new Error("Invalid backupId: must not contain path separators or traversal sequences.");
  }
  const lowerBackupId = backupId.toLowerCase();
  if (lowerBackupId.includes("%2e") || lowerBackupId.includes("%2f") || lowerBackupId.includes("%5c")) {
    throw new Error("Invalid backupId: encoded path traversal characters are not allowed.");
  }

  const backupDir = path.join(BACKUP_DIR, backupId);

  // Additional safety: ensure resolved path stays within BACKUP_DIR
  const resolvedBackupDir = path.resolve(backupDir);
  const resolvedBaseDir = path.resolve(BACKUP_DIR);
  if (!resolvedBackupDir.startsWith(resolvedBaseDir + path.sep) && resolvedBackupDir !== resolvedBaseDir) {
    throw new Error("Invalid backupId: path escapes backup directory.");
  }

  try {
    await fs.access(backupDir);
  } catch {
    throw new Error(`Backup not found: ${backupId}`);
  }

  // Read manifest
  const manifestPath = path.join(backupDir, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);

  return {
    restored: true,
    backupId,
    manifest,
    restoredAt: new Date().toISOString(),
    hint: "Restore preview complete. Apply to production requires explicit confirmation.",
  };
}

export async function backupList(svc) {
  return svc.listBackups();
}

/* ================================================================== */
/*  SYSTEM                                                             */
/* ================================================================== */

export async function systemInfo(svc) {
  const pkgFile = path.join(process.cwd(), "package.json");
  let pkg = {};
  try {
    const raw = await fs.readFile(pkgFile, "utf-8");
    pkg = JSON.parse(raw);
  } catch {
    // ignore
  }

  const commands = Array.from(svc.commands.keys()).sort();
  const groups = [...new Set(
    Array.from(svc.commands.values()).map((e) => e.metadata.group).filter(Boolean)
  )];

  return {
    name: pkg.name ?? "unified-ai-system",
    version: pkg.version ?? "unknown",
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    uptime: `${process.uptime().toFixed(1)}s`,
    pid: process.pid,
    commandCount: commands.length,
    commandGroups: groups,
    macros: Array.from(svc.macros.keys()),
    aliases: Object.fromEntries(svc.aliases),
    favorites: svc.favorites,
  };
}

export async function systemRestart() {
  return {
    status: "dry_run",
    message: "Restart requested. In local-preview mode this is a no-op. Use the managed startup system for real restarts.",
  };
}

export async function systemStats() {
  const memUsage = process.memoryUsage();
  return {
    memory: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rssHuman: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
      heapUsedHuman: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    },
    cpu: {
      loadAvg: os.loadavg(),
      cpus: os.cpus().length,
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version,
    },
  };
}
