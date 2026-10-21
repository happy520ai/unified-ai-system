// Extracted verbatim from localClientManagementCore.ts so the discovery
// cluster and its transitive helper/const closure live beside the core
// module. The core imports these symbols back; the moved set depends only on
// the scoring primitives, the types file, and node builtins, so there is no
// runtime cycle. Pure mechanical move; behaviour unchanged.
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import type { DiscoveryHintInput, UnknownRecord, LocalClientErrorOptions, LocalClientServiceError, LocalClientSystemDiscoverInput, DiscoveryHint, NormalizedProcessRow, ProcessRow, LocalClientInput, StoredClientMetadata } from "./localClientManagementCore.types.ts";
import { safeTrim, now } from "./localClientScoring.ts";
import { access, readFile } from "node:fs/promises";

export const execFileAsync = promisify(execFile);

export const WINDOWS_TASKLIST_MAX_ROWS = 4000;

export const WINDOWS_TASKLIST_TIMEOUT_MS = 20_000;

export const DEFAULT_UNKNOWN_TASK_CAPABILITIES = ["local_application"];

export const FALLBACK_UNKNOWN_CAPABILITIES = ["local-process-control", "local-application"];

export const DISPATCHER_PROCESS_KEYWORDS = Object.freeze(new Set([
  "system",
  "system idle process",
  "secure system",
  "registry",
  "memory compression",
  "svchost",
  "csrss",
  "smss",
  "wininit",
  "winlogon",
  "fontdrvhost",
  "spoolsv",
  "ctfmon",
  "dwm",
  "lsass",
  "services",
  "runtimebroker",
  "sihost",
  "search",
  "rundll32",
  "conhost",
  "taskhostw",
  "backgroundtaskhost",
  "shellexperiencehost",
  "startmenuexperiencehost",
  "textinputhost",
  "lockapp",
  "wudfhost",
  "wmiprvse",
  "dllhost",
  "explorer",
]));

export const STABLE_ID_NAMESPACE = "localclient";

export const BUILTIN_DISCOVERY_HINTS: DiscoveryHintInput[] = [
  {
    processName: "chrome",
    capabilities: ["browser", "web_automation", "communication"],
    tags: ["browser", "discovered"],
    priority: 65,
    trustLevel: "high",
    displayName: "Chrome",
  },
  {
    processName: "msedge",
    capabilities: ["browser", "web_automation", "communication"],
    tags: ["browser", "discovered"],
    priority: 64,
    trustLevel: "high",
    displayName: "Microsoft Edge",
  },
  {
    processName: "firefox",
    capabilities: ["browser", "web_automation", "communication"],
    tags: ["browser", "discovered"],
    priority: 62,
    trustLevel: "high",
    displayName: "Firefox",
  },
  {
    processName: "code",
    capabilities: ["editor", "ide", "local_workflow", "file_operation", "terminal"],
    tags: ["editor", "discovered"],
    priority: 78,
    trustLevel: "high",
    displayName: "Visual Studio Code",
  },
  {
    processName: "idea64",
    capabilities: ["editor", "ide", "local_workflow", "file_operation"],
    tags: ["editor", "discovered"],
    priority: 76,
    trustLevel: "high",
    displayName: "IntelliJ IDEA",
  },
  {
    processName: "wechat",
    capabilities: ["chat", "communication", "notifications"],
    tags: ["chat", "discovered"],
    priority: 70,
    trustLevel: "medium",
    displayName: "WeChat",
  },
  {
    processName: "teams",
    capabilities: ["chat", "collaboration", "meeting"],
    tags: ["chat", "discovered"],
    priority: 68,
    trustLevel: "medium",
    displayName: "Microsoft Teams",
  },
  {
    processName: "slack",
    capabilities: ["chat", "communication", "collaboration"],
    tags: ["chat", "discovered"],
    priority: 69,
    trustLevel: "medium",
    displayName: "Slack",
  },
  {
    processName: "terminal",
    capabilities: ["terminal", "automation", "scripting"],
    tags: ["terminal", "discovered"],
    priority: 72,
    trustLevel: "high",
    displayName: "Terminal",
  },
  {
    processName: "powershell",
    capabilities: ["terminal", "automation", "scripting"],
    tags: ["terminal", "discovered"],
    priority: 70,
    trustLevel: "medium",
    displayName: "PowerShell",
  },
];

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeTaskText(value: unknown): string {
  const text = safeTrim(value);
  return text.toLowerCase();
}

export function safeTrimOrNull(value: unknown): string | null {
  const trimmed = safeTrim(value, "");
  return trimmed || null;
}

export function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const next: string[] = [];
  for (const item of value) {
    const text = safeTrim(item);
    if (text) next.push(text.toLowerCase());
  }
  return Array.from(new Set(next));
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createStableClientId(namespace: string, value: unknown): string {
  const normalized = safeTrim(value, "client").toLowerCase();
  const hash = stableHash(`${namespace}:${normalized}`);
  const safe = normalized.replace(/[^a-z0-9._-]+/gu, "_").replace(/_+/gu, "_").replace(/^_|_$/gu, "");
  return `client_${safe || "unknown"}_${hash}`;
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

export function normalizeCapability(value: unknown): string {
  return safeTrim(value, "")
    .toLowerCase()
    .replace(/[-\s]+/gu, "_");
}

export function normalizeAbortSignal(value: unknown): AbortSignal | undefined {
  if (value === undefined) return undefined;
  if (!(value instanceof AbortSignal)) {
    throw createError(
      "local_client_abort_signal_invalid",
      "The internal local-client cancellation signal is invalid.",
      { statusCode: 400, category: "validation" },
    );
  }
  return value;
}

export function throwIfLocalClientAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw createError(
    "local_client_operation_aborted",
    "The local-client management operation was cancelled.",
    { statusCode: 499, category: "cancellation" },
  );
}

export function parsePositiveInt(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function parseOptionalPositiveInt(value: unknown, fallback: null, minimum?: number, maximum?: number): number | null;
export function parseOptionalPositiveInt(value: unknown, fallback: number, minimum?: number, maximum?: number): number;
export function parseOptionalPositiveInt(
  value: unknown,
  fallback: number | null,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true, () => false);
}

export function createError(code: string, message: string, options: LocalClientErrorOptions = {}): LocalClientServiceError {
  const error = new Error(message) as LocalClientServiceError;
  error.code = code;
  error.statusCode = options.statusCode ?? 422;
  error.category = options.category ?? "validation";
  if (options.details) {
    error.details = options.details;
  }
  return error;
}

export function normalizeSystemDiscoverInput(input: LocalClientSystemDiscoverInput | null | undefined) {
  if (!input || typeof input !== "object") {
    return {
      source: "local-process-scan",
      maxProcesses: 200,
      includeUnknown: false,
      includeSystemProcesses: false,
      dryRun: false,
      includeDisabled: false,
      includeMissingAsDisabled: false,
      autoDiscoverAll: false,
      signal: undefined,
    };
  }
  const includeDisabled = normalizeBoolean(input.includeDisabled, false);
  const autoDiscoverAll = normalizeBoolean(input.autoDiscoverAll, false);
  const effectiveMaxProcesses = autoDiscoverAll ? WINDOWS_TASKLIST_MAX_ROWS : 200;
  const includeMissingAsDisabled = normalizeBoolean(
    input.includeMissingAsDisabled,
    includeDisabled || autoDiscoverAll,
  );
  return {
    source: safeTrim(input.source, "local-process-scan"),
    maxProcesses: parseOptionalPositiveInt(input.maxProcesses, effectiveMaxProcesses, 1, 10_000),
    includeUnknown: autoDiscoverAll ? true : normalizeBoolean(input.includeUnknown, false),
    includeSystemProcesses: normalizeBoolean(input.includeSystemProcesses, false),
    dryRun: normalizeBoolean(input.dryRun, false),
    includeDisabled,
    includeMissingAsDisabled,
    autoDiscoverAll,
    signal: normalizeAbortSignal(input.signal),
  };
}

export function parseCsvLine(line: unknown): string[] {
  const normalized = safeTrim(line, "");
  if (!normalized) return [];
  const values: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

export function normalizeProcessName(raw: unknown): string {
  const safe = safeTrim(raw, "").toLowerCase();
  if (!safe) return "";
  return safe.replace(/\.exe$/u, "");
}

export function toStableHintMap(rawHints: unknown): Map<string, DiscoveryHint> {
  const map = new Map<string, DiscoveryHint>();
  const list: unknown[] = Array.isArray(rawHints) ? rawHints : [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const rawHint = item as DiscoveryHintInput;
    const processName = normalizeProcessName(rawHint?.processName || rawHint?.name || rawHint?.executable || rawHint?.id);
    if (!processName) {
      continue;
    }
    const capabilities = toList(rawHint?.capabilities).map(normalizeCapability);
    const tags = toList(rawHint?.tags).map(normalizeCapability);
    const priority = parsePositiveInt(rawHint?.priority, 50, 0, 100);
    const trustLevel = safeTrim(rawHint?.trustLevel, "medium");
    const clientId = safeTrim(rawHint?.clientId);
    const aliases = new Set<string>([processName]);
    if (Array.isArray(rawHint?.aliases)) {
      for (const alias of rawHint.aliases) {
        const normalizedAlias = normalizeProcessName(alias);
        if (normalizedAlias) aliases.add(normalizedAlias);
      }
    }
    const record: DiscoveryHint = {
      processName,
      displayName: safeTrim(rawHint?.displayName, processName),
      description: safeTrim(rawHint?.description),
      capabilities: capabilities.length ? capabilities : FALLBACK_UNKNOWN_CAPABILITIES,
      tags,
      preferred: normalizeBoolean(rawHint?.preferred, false),
      priority,
      trustLevel,
      clientId,
      aliases: Array.from(aliases.values()),
    };
    for (const alias of aliases) {
      map.set(alias, record);
    }
  }
  return map;
}

export function buildBuiltInHintMap(): Map<string, DiscoveryHint> {
  return toStableHintMap(BUILTIN_DISCOVERY_HINTS);
}

export function isSystemProcessRow(
  row: NormalizedProcessRow,
  includeSystemProcesses: boolean,
): boolean {
  if (includeSystemProcesses) return false;
  if (DISPATCHER_PROCESS_KEYWORDS.has(row.processName)) return true;
  if (process.platform !== "win32") return false;
  const userName = row.userName.toLowerCase();
  return row.sessionId === 0
    || row.sessionName.toLowerCase() === "services"
    || /^(?:nt authority\\)?(?:system|local service|network service)$/u.test(userName);
}

export function inferCapabilitiesByName(processName: unknown): string[] {
  const normalized = normalizeProcessName(processName);
  if (!normalized) return FALLBACK_UNKNOWN_CAPABILITIES;
  if (normalized.includes("chrome") || normalized.includes("firefox") || normalized.includes("edge")) {
    return ["browser", "web_automation"];
  }
  if (normalized.includes("code") || normalized.includes("idea") || normalized.includes("sublime") || normalized.includes("editor")) {
    return ["editor", "ide", "file_operation"];
  }
  if (normalized.includes("pycharm") || normalized.includes("clion") || normalized.includes("intellij")) {
    return ["editor", "ide", "file_operation", "local_workflow"];
  }
  if (normalized.includes("wechat") || normalized.includes("wechatwork") || normalized.includes("dingtalk") || normalized.includes("telegram")) {
    return ["chat", "communication"];
  }
  if (normalized.includes("feishu") || normalized.includes("lark") || normalized.includes("wec") || normalized.includes("wxc")) {
    return ["chat", "communication"];
  }
  if (normalized.includes("slack") || normalized.includes("wechat") || normalized.includes("teams") || normalized.includes("discord")) {
    return ["chat", "communication"];
  }
  if (normalized.includes("notepad") || normalized.includes("vim") || normalized.includes("nano")) {
    return ["text", "editor"];
  }
  if (normalized.includes("terminal") || normalized.includes("cmd") || normalized.includes("powershell")) {
    return ["terminal", "automation", "scripting"];
  }
  return FALLBACK_UNKNOWN_CAPABILITIES;
}

export function inferTaskCapabilities(taskText: unknown): string[] {
  const normalized = normalizeTaskText(taskText);
  if (!normalized) {
    return [];
  }
  const inferred = new Set<string>();
  const add = (keywords: string[], capabilities: string[]) => {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      for (const capability of capabilities) {
        inferred.add(capability);
      }
    }
  };
  add([
    "浏览器", "网页", "browser", "web", "网站", "网址", "搜索",
  ], ["web_automation", "browser", "local_workflow"]);
  if (normalized.includes("浏览器") || normalized.includes("网页") || normalized.includes("browser") || normalized.includes("web")) {
    inferred.add("web_automation");
    inferred.add("browser");
  }
  if (normalized.includes("编辑") || normalized.includes("写") || normalized.includes("markdown") || normalized.includes("代码") || normalized.includes("code")
    || normalized.includes("vscode") || normalized.includes("pycharm") || normalized.includes("idea") || normalized.includes("editor")) {
    inferred.add("editor");
    inferred.add("file_operation");
    inferred.add("local_workflow");
  }
  add([
    "终端", "shell", "cmd", "powershell", "terminal", "运行", "执行", "自动化", "automate", "脚本",
  ], ["terminal", "automation", "scripting", "local_workflow"]);
  if (normalized.includes("终端") || normalized.includes("shell") || normalized.includes("cmd") || normalized.includes("powershell") || normalized.includes("terminal")
    || normalized.includes("执行") || normalized.includes("自动化") || normalized.includes("automate")) {
    inferred.add("automation");
    inferred.add("terminal");
    inferred.add("scripting");
  }
  add([
    "聊天", "沟通", "消息", "chat", "wechat", "teams", "slack", "discord", "飞书", "dingtalk", "钉钉",
  ], ["chat", "communication"]);
  if (normalized.includes("聊天") || normalized.includes("沟通") || normalized.includes("消息") || normalized.includes("chat") || normalized.includes("wechat")
    || normalized.includes("teams") || normalized.includes("slack") || normalized.includes("discord")) {
    inferred.add("chat");
    inferred.add("communication");
  }
  add(["文件", "文档", "folder", "目录", "导出", "导入", "excel", "word", "ppt", "pdf", "markdown"], ["file_operation", "local_workflow"]);
  if (normalized.includes("文件") || normalized.includes("文档") || normalized.includes("folder") || normalized.includes("目录") || normalized.includes("导出") || normalized.includes("导入")) {
    inferred.add("file_operation");
  }
  add(["通知", "提醒", "提醒事项", "提醒我", "闹钟", "deadline"], ["notifications", "calendar"]);
  if (normalized.includes("通知") || normalized.includes("提醒") || normalized.includes("提醒事项")) {
    inferred.add("notifications");
  }
  add(["视频", "图片", "截图", "录屏", "摄像头", "画图"], ["media_capture", "automation"]);
  if (inferred.size === 0) {
    return DEFAULT_UNKNOWN_TASK_CAPABILITIES.slice();
  }
  return Array.from(inferred);
}

export function normalizeProcessRow(lineOrObject: ProcessRow | null | undefined): NormalizedProcessRow | null {
  if (!lineOrObject) return null;
  const imageName = safeTrim(lineOrObject.imageName || lineOrObject.name || lineOrObject.processName);
  const normalized = normalizeProcessName(imageName);
  if (!normalized) return null;
  return {
    processName: normalized,
    executable: safeTrimOrNull(lineOrObject.executablePath || lineOrObject.path) || normalized,
    pid: parseOptionalPositiveInt(lineOrObject.pid, null, 1, Number.MAX_SAFE_INTEGER),
    sessionName: safeTrim(lineOrObject.sessionName, ""),
    sessionId: parseOptionalPositiveInt(lineOrObject.sessionId, null, 0, Number.MAX_SAFE_INTEGER),
    userName: safeTrim(lineOrObject.userName, ""),
  };
}

export function buildDiscoverableClient(
  hint: DiscoveryHint | undefined,
  processName: string,
  request: ReturnType<typeof normalizeSystemDiscoverInput>,
  rawProcess: NormalizedProcessRow,
): LocalClientInput & { clientId: string } {
  const discoveredName = safeTrim(hint?.displayName, processName);
  const capabilities = Array.isArray(hint?.capabilities) && hint.capabilities.length ? hint.capabilities : inferCapabilitiesByName(processName);
  const tags: string[] = Array.isArray(hint?.tags) ? hint.tags : [];
  const metadata: StoredClientMetadata = {
    discoveredBy: "local-process-scan",
    discoverSource: request.source,
    processPid: rawProcess?.pid,
    sourceRaw: processName,
  };
  return {
    // The observation source is audit metadata, not client identity. Manual
    // discovery and smart-management rounds must converge on one stable record.
    clientId: hint?.clientId || createStableClientId(STABLE_ID_NAMESPACE, `system-scan:${processName}`),
    name: discoveredName,
    displayName: discoveredName,
    description: hint?.description ?? `Auto-discovered local process ${processName}`,
    executable: safeTrimOrNull(rawProcess?.executable) || null,
    platform: process.platform,
    capabilities: toList(capabilities).map(normalizeCapability),
    tags: Array.from(new Set(["auto-discovery", "system-scan", ...tags.map((item) => normalizeCapability(item))])),
    metadata,
    health: {
      status: "unknown",
      latencyMs: null,
      lastError: null,
      updatedAt: now(),
    },
    trustLevel: safeTrim(hint?.trustLevel, "medium"),
    load: {
      cpu: NaN,
      memory: NaN,
      queueDepth: 0,
    },
    priority: parsePositiveInt(hint?.priority, 50, 0, 100),
    preferred: normalizeBoolean(hint?.preferred, false),
    stableKey: createStableClientId(STABLE_ID_NAMESPACE, `${processName}:${process.platform}`),
    discoveredAt: now(),
    lastSeenAt: now(),
    updatedAt: now(),
  };
}

export async function readDiscoveryHints(pathHint: string): Promise<Map<string, DiscoveryHint>> {
  if (!pathHint) return new Map<string, DiscoveryHint>();
  if (!await fileExists(pathHint)) return new Map();
  try {
    const raw = await readJson(pathHint);
    if (Array.isArray(raw)) {
      return toStableHintMap(raw);
    }
    if (isRecord(raw)) {
      return toStableHintMap(
        Object.entries(raw).map(([name, item]) => {
          if (!isRecord(item)) {
            return { processName: name, capabilities: item };
          }
          return { processName: safeTrim(item.processName, name), ...item };
        }),
      );
    }
  } catch {
    return new Map<string, DiscoveryHint>();
  }
  return new Map<string, DiscoveryHint>();
}

export function safeNumberOrNaN(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function listProcessRows(
  maxRows = WINDOWS_TASKLIST_MAX_ROWS,
  signal?: AbortSignal,
): Promise<ProcessRow[]> {
  throwIfLocalClientAborted(signal);
  const safeMaxRows = Math.min(Math.max(1, maxRows), WINDOWS_TASKLIST_MAX_ROWS);
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync("tasklist", ["/v", "/fo", "csv", "/nh"], {
      timeout: WINDOWS_TASKLIST_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
      signal,
    });
    throwIfLocalClientAborted(signal);
    return stdout
      .split(/\r?\n/)
      .slice(0, safeMaxRows)
      .map(parseCsvLine)
      .map((cells) => ({
        imageName: cells[0],
        pid: cells[1],
        sessionName: cells[2],
        sessionId: cells[3],
        userName: cells[6],
      }))
      .filter((item) => item.imageName);
  }
  const { stdout } = await execFileAsync("ps", ["-eo", "comm="], {
    timeout: 6_000,
    maxBuffer: 2 * 1024 * 1024,
    signal,
  });
  throwIfLocalClientAborted(signal);
  return stdout
    .split(/\r?\n/)
    .slice(0, safeMaxRows)
    .map((line) => safeTrim(line))
    .filter(Boolean)
    .map((line) => ({ imageName: line }));
}

export function buildDiscoveryCandidates(
  processRows: ProcessRow[],
  hintsMap: Map<string, DiscoveryHint>,
  request: ReturnType<typeof normalizeSystemDiscoverInput>,
) {
  const candidates: Array<LocalClientInput & { clientId: string }> = [];
  const seenClientIds = new Set<string>();
  const seenProcesses = new Set<string>();
  const dropped = {
    filteredSystemProcessCount: 0,
    filteredUnknownCount: 0,
    duplicateProcessCount: 0,
  };

  for (const processRow of processRows) {
    const normalized = normalizeProcessRow(processRow);
    if (!normalized) continue;
    const processName = normalized.processName;
    if (seenProcesses.has(processName)) {
      dropped.duplicateProcessCount += 1;
      continue;
    }
    if (isSystemProcessRow(normalized, request.includeSystemProcesses)) {
      dropped.filteredSystemProcessCount += 1;
      continue;
    }
    const matchedHint = hintsMap.get(processName);
    if (!matchedHint && !request.includeUnknown) {
      dropped.filteredUnknownCount += 1;
      continue;
    }
    const hint = matchedHint || {
      processName,
      capabilities: FALLBACK_UNKNOWN_CAPABILITIES,
      tags: ["auto-discovery", "unknown"],
      priority: 40,
      trustLevel: "low",
      preferred: false,
      displayName: processName,
    };
    const discoverable = buildDiscoverableClient(hint, processName, request, normalized);
    if (seenClientIds.has(discoverable.clientId)) {
      dropped.duplicateProcessCount += 1;
      continue;
    }
    seenClientIds.add(discoverable.clientId);
    seenProcesses.add(processName);
    candidates.push(discoverable);
  }

  return { candidates, dropped };
}

export async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed : null;
}
