import fs from "fs/promises";
import path from "path";
import { DATA_DIR, BACKUP_DIR, COMMAND_HISTORY_FILE } from "./commandPaletteConstants.js";

/* ---- Extracted handler imports ---- */
import {
  providerList, providerAdd, providerRemove, providerTest, providerHealth,
} from "./commandPaletteProviderHandlers.js";
import {
  billingSummary, billingInvoice, billingUsage,
} from "./commandPaletteBillingHandlers.js";
import {
  securityAudit, securityScan, securityStatus,
} from "./commandPaletteSecurityHandlers.js";
import {
  neuronList, neuronEvolve, neuronEnable, neuronDisable, neuronExecute,
  workforcePlan, workforceStatus, workforceAssign, workforceCancel,
  deployStatus, deployRollback, deployHealth,
  backupCreate, backupRestore, backupList,
  systemInfo, systemRestart, systemStats,
} from "./commandPaletteMiscHandlers.js";

/**
 * Owner Automation Command Palette
 *
 * Provides a powerful command interface for system administration.
 * Commands: /provider, /neuron, /workforce, /billing, /security, /deploy,
 *           /backup, /system
 *
 * Handler implementations live in sibling files:
 *   commandPaletteProviderHandlers.js
 *   commandPaletteBillingHandlers.js
 *   commandPaletteSecurityHandlers.js
 *   commandPaletteMiscHandlers.js
 */

/**
 * @typedef {object} CommandResult
 * @property {boolean} success
 * @property {string}  command
 * @property {object}  data
 * @property {string}  [error]
 * @property {string}  timestamp
 */

export class CommandPaletteService {
  /**
   * @param {object} [gatewayContext]  References to live gateway services
   * @param {object} [gatewayContext.providerRegistry]
   * @param {object} [gatewayContext.taskQueueManager]
   * @param {object} [gatewayContext.knowledgeRAG]
   */
  constructor(gatewayContext = {}) {
    /** @type {object} */
    this.gatewayContext = gatewayContext;
    /** @type {Map<string, {handler: Function, metadata: object}>} */
    this.commands = new Map();
    /** @type {object[]} */
    this.commandHistory = [];
    /** @type {string[]} */
    this.favorites = [];
    /** @type {Map<string, string>} alias -> canonical command */
    this.aliases = new Map();
    /** @type {Map<string, string[]>} macro name -> command sequence */
    this.macros = new Map();
    /** @type {object[]} */
    this.recentCommands = [];
    /** @type {number} */
    this.maxHistory = 100;
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    this.registerBuiltInCommands();
    await this._loadHistory();
  }

  /* ------------------------------------------------------------------ */
  /*  Built-in Command Registration                                      */
  /* ------------------------------------------------------------------ */

  registerBuiltInCommands() {
    const svc = this;

    // ---- /provider ----
    this._register("provider list", providerList.bind(null, svc), {
      description: "List all configured providers", group: "provider",
    });
    this._register("provider add", providerAdd.bind(null, svc), {
      description: "Add a new provider (args: id, name, baseUrl)", group: "provider",
      args: ["id", "name", "baseUrl"],
    });
    this._register("provider remove", providerRemove.bind(null, svc), {
      description: "Remove a provider by id", group: "provider", args: ["id"],
    });
    this._register("provider test", providerTest.bind(null, svc), {
      description: "Test a provider connection", group: "provider", args: ["id"],
    });
    this._register("provider health", providerHealth.bind(null, svc), {
      description: "Check health of all providers", group: "provider",
    });

    // ---- /neuron ----
    this._register("neuron list", neuronList.bind(null), {
      description: "List registered neurons / skills", group: "neuron",
    });
    this._register("neuron evolve", neuronEvolve.bind(null), {
      description: "Trigger self-evolution pipeline", group: "neuron",
    });
    this._register("neuron enable", neuronEnable.bind(null), {
      description: "Enable a neuron by id", group: "neuron", args: ["id"],
    });
    this._register("neuron disable", neuronDisable.bind(null), {
      description: "Disable a neuron by id", group: "neuron", args: ["id"],
    });
    this._register("neuron execute", neuronExecute.bind(null), {
      description: "Execute a neuron by id", group: "neuron", args: ["id"],
    });

    // ---- /workforce ----
    this._register("workforce plan", workforcePlan.bind(null, svc), {
      description: "Create a workforce plan", group: "workforce", args: ["goal"],
    });
    this._register("workforce status", workforceStatus.bind(null, svc), {
      description: "Get workforce queue status", group: "workforce",
    });
    this._register("workforce assign", workforceAssign.bind(null, svc), {
      description: "Auto-assign queued tasks", group: "workforce",
    });
    this._register("workforce cancel", workforceCancel.bind(null, svc), {
      description: "Cancel a task by id", group: "workforce", args: ["taskId"],
    });

    // ---- /billing ----
    this._register("billing summary", billingSummary.bind(null), {
      description: "Show billing / cost summary", group: "billing",
    });
    this._register("billing invoice", billingInvoice.bind(null), {
      description: "Generate usage invoice", group: "billing",
    });
    this._register("billing usage", billingUsage.bind(null), {
      description: "Show detailed usage breakdown", group: "billing",
    });

    // ---- /security ----
    this._register("security audit", securityAudit.bind(null, svc), {
      description: "Run a quick security audit", group: "security",
    });
    this._register("security scan", securityScan.bind(null), {
      description: "Scan for exposed secrets", group: "security",
    });
    this._register("security status", securityStatus.bind(null, svc), {
      description: "Show security posture", group: "security",
    });

    // ---- /deploy ----
    this._register("deploy status", deployStatus.bind(null), {
      description: "Show deployment status", group: "deploy",
    });
    this._register("deploy rollback", deployRollback.bind(null), {
      description: "Rollback to previous version", group: "deploy",
    });
    this._register("deploy health", deployHealth.bind(null), {
      description: "Check deployment health", group: "deploy",
    });

    // ---- /backup ----
    this._register("backup create", backupCreate.bind(null, svc), {
      description: "Create a full system backup", group: "backup",
    });
    this._register("backup restore", backupRestore.bind(null, svc), {
      description: "Restore from a backup", group: "backup", args: ["backupId"],
    });
    this._register("backup list", backupList.bind(null, svc), {
      description: "List available backups", group: "backup",
    });

    // ---- /system ----
    this._register("system info", systemInfo.bind(null, svc), {
      description: "Show system information", group: "system",
    });
    this._register("system restart", systemRestart.bind(null), {
      description: "Request system restart (dry-run in preview)", group: "system",
    });
    this._register("system stats", systemStats.bind(null), {
      description: "Show system resource statistics", group: "system",
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Execution                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Execute a command string.
   * @param {string} commandString  e.g. "/provider list"
   * @returns {Promise<CommandResult>}
   */
  async execute(commandString) {
    const input = String(commandString ?? "").trim();
    if (!input) return this._fail("", "Empty command");

    if (this.macros.has(input)) return this.executeMacro(input);

    const { command, args } = this.parseCommand(input);
    const resolved = this.aliases.get(command) ?? command;

    const entry = this.commands.get(resolved);
    if (!entry) return this._fail(input, `Unknown command: ${resolved}. Use /system info for help.`);

    const startTime = Date.now();
    try {
      const data = await entry.handler(args);
      const result = {
        success: true, command: resolved, data,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this._recordHistory(input, result);
      return result;
    } catch (err) {
      const result = this._fail(input, err.message);
      result.durationMs = Date.now() - startTime;
      this._recordHistory(input, result);
      return result;
    }
  }

  /**
   * Parse a command string into command name and arguments.
   * @param {string} input  e.g. "/provider add id=foo name=Bar baseUrl=http://..."
   * @returns {{ command: string, args: Record<string, string> }}
   */
  parseCommand(input) {
    let cleaned = input.startsWith("/") ? input.slice(1) : input;
    cleaned = cleaned.trim();

    const tokens = cleaned.split(/\s+/);
    let command = "";
    let argsStart = 1;

    if (tokens.length >= 2) {
      const twoToken = `${tokens[0]} ${tokens[1]}`;
      if (this.commands.has(twoToken)) {
        command = twoToken;
        argsStart = 2;
      } else {
        command = tokens[0];
        argsStart = 1;
      }
    } else {
      command = tokens[0] ?? "";
    }

    const args = {};
    let positionalIndex = 0;
    for (let i = argsStart; i < tokens.length; i++) {
      const token = tokens[i];
      const eqIndex = token.indexOf("=");
      if (eqIndex > 0) {
        args[token.slice(0, eqIndex)] = token.slice(eqIndex + 1);
      } else {
        args[`_pos${positionalIndex}`] = token;
        positionalIndex++;
      }
    }

    return { command, args };
  }

  /* ------------------------------------------------------------------ */
  /*  Command Registration                                               */
  /* ------------------------------------------------------------------ */

  registerCommand(name, handler, metadata = {}) {
    this._register(name, handler, metadata);
  }

  /** @private */
  _register(name, handler, metadata = {}) {
    this.commands.set(name, { handler, metadata });
  }

  /* ------------------------------------------------------------------ */
  /*  Macros                                                             */
  /* ------------------------------------------------------------------ */

  registerMacro(name, commands) {
    if (!name || !Array.isArray(commands) || commands.length === 0) {
      throw new Error("Macro requires a name and at least one command.");
    }
    this.macros.set(name, commands);
  }

  async executeMacro(name) {
    const commands = this.macros.get(name);
    if (!commands) throw new Error(`Macro not found: ${name}`);

    const results = [];
    for (const cmd of commands) results.push(await this.execute(cmd));

    return {
      success: results.every((r) => r.success),
      command: `macro:${name}`,
      data: { macro: name, steps: results },
      timestamp: new Date().toISOString(),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Search & Suggestions                                               */
  /* ------------------------------------------------------------------ */

  searchCommands(keyword) {
    const kw = String(keyword ?? "").toLowerCase();
    const results = [];
    for (const [name, entry] of this.commands) {
      const desc = (entry.metadata.description ?? "").toLowerCase();
      const group = (entry.metadata.group ?? "").toLowerCase();
      if (name.includes(kw) || desc.includes(kw) || group.includes(kw)) {
        results.push({ command: `/${name}`, ...entry.metadata });
      }
    }
    return results;
  }

  getSuggestions(partial) {
    const cleaned = (partial.startsWith("/") ? partial.slice(1) : partial).toLowerCase();
    const suggestions = [];
    for (const name of this.commands.keys()) {
      if (name.startsWith(cleaned)) suggestions.push(`/${name}`);
    }
    for (const macroName of this.macros.keys()) {
      if (macroName.toLowerCase().startsWith(cleaned)) suggestions.push(macroName);
    }
    return suggestions.sort();
  }

  getHistory(limit = 20) {
    return this.commandHistory.slice(-limit).reverse();
  }

  addFavorite(command) {
    if (!this.favorites.includes(command)) this.favorites.push(command);
  }

  /* ================================================================== */
  /*  Public helpers                                                     */
  /* ================================================================== */

  async getSystemInfo() {
    return systemInfo(this);
  }

  async createBackup() {
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const backupId = `backup-${Date.now()}`;
    const backupDir = path.join(BACKUP_DIR, backupId);
    await fs.mkdir(backupDir, { recursive: true });

    const manifest = { backupId, createdAt: new Date().toISOString(), files: [] };

    try {
      const configRaw = await fs.readFile(path.join(process.cwd(), "providers-config.json"), "utf-8");
      await fs.writeFile(path.join(backupDir, "providers-config.json"), configRaw, "utf-8");
      manifest.files.push("providers-config.json");
    } catch { /* skip */ }

    try {
      const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "backups") continue;
        const srcPath = path.join(DATA_DIR, entry.name);
        const dstPath = path.join(backupDir, entry.name);
        if (entry.isFile()) {
          await fs.copyFile(srcPath, dstPath);
          manifest.files.push(`.data/${entry.name}`);
        } else if (entry.isDirectory()) {
          await _copyDir(srcPath, dstPath);
          manifest.files.push(`.data/${entry.name}/`);
        }
      }
    } catch { /* skip */ }

    await fs.writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    return { backupId, filesBacked: manifest.files.length, location: backupDir, createdAt: manifest.createdAt };
  }

  async listBackups() {
    try {
      const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
      const backups = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const raw = await fs.readFile(path.join(BACKUP_DIR, entry.name, "manifest.json"), "utf-8");
          const manifest = JSON.parse(raw);
          backups.push({ backupId: entry.name, createdAt: manifest.createdAt, files: manifest.files?.length ?? 0 });
        } catch {
          backups.push({ backupId: entry.name, createdAt: "unknown", files: 0, error: "manifest unreadable" });
        }
      }
      return { count: backups.length, backups };
    } catch {
      return { count: 0, backups: [] };
    }
  }

  /* ================================================================== */
  /*  Private helpers                                                    */
  /* ================================================================== */

  async _readProvidersConfig() {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), "providers-config.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      return { providers: [] };
    }
  }

  async _writeProvidersConfig(config) {
    await fs.writeFile(
      path.join(process.cwd(), "providers-config.json"),
      JSON.stringify(config, null, 2), "utf-8"
    );
  }

  async _loadHistory() {
    try {
      const raw = await fs.readFile(COMMAND_HISTORY_FILE, "utf-8");
      const data = JSON.parse(raw);
      this.commandHistory = Array.isArray(data.history) ? data.history : [];
      this.favorites = Array.isArray(data.favorites) ? data.favorites : [];
    } catch {
      this.commandHistory = [];
      this.favorites = [];
    }
  }

  async _saveHistory() {
    const payload = {
      history: this.commandHistory.slice(-this.maxHistory),
      favorites: this.favorites,
    };
    await fs.writeFile(COMMAND_HISTORY_FILE, JSON.stringify(payload, null, 2), "utf-8");
  }

  _recordHistory(input, result) {
    this.commandHistory.push({
      input, success: result.success,
      timestamp: result.timestamp ?? new Date().toISOString(),
    });
    this.recentCommands.push(input);
    if (this.recentCommands.length > 20) this.recentCommands = this.recentCommands.slice(-20);
    this._saveHistory().catch((err) => { console.warn("[commandPalette] saveHistory failed:", err?.message); });
  }

  _fail(command, error) {
    return { success: false, command, error, data: null, timestamp: new Date().toISOString() };
  }
}

/* ==================================================================== */
/*  Module-private helpers                                               */
/* ==================================================================== */

async function _copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isFile()) {
      await fs.copyFile(srcPath, dstPath);
    } else if (entry.isDirectory()) {
      await _copyDir(srcPath, dstPath);
    }
  }
}
