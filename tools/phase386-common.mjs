import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase386Safety = {
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  externalUploadPerformed: false,
  releaseArtifactCreated: false,
  billingExecuted: false,
  invoiceGenerated: false,
  approvalForged: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
};

export const phase386Contract = {
  phase: "Phase386",
  title: "Yiyi Commercial Demo Package + Guided Showcase",
  demoMode: "guided_showcase",
  providerCallsAllowed: false,
  modelBrainEnabledByDefault: false,
  deployAllowed: false,
  billingAllowed: false,
  targetAudience: ["internal_review", "commercial_demo", "product_pitch", "technical_showcase"],
  showcaseSteps: [
    "welcome",
    "mission_control_overview",
    "normal_mode_preview",
    "god_mode_arena_preview",
    "tianshu_planning_preview",
    "security_shield_demo",
    "red_team_block_demo",
    "evidence_replay_demo",
    "yiyi_brain_status",
    "closing_summary",
  ],
};

export const phase386Scenarios = [
  {
    scenarioId: "welcome",
    title: "Welcome",
    yiyiLine: "欢迎来到 Mission Control。我会带你看一套 dry-run 演示，不读密钥，不调用 Provider，也不部署。",
    emotionState: "calm",
    behaviorState: "welcome",
    highlightPanel: "yiyi_avatar_layer",
    safetyBadges: ["dry-run only", "no secret", "no provider call", "no deploy"],
  },
  {
    scenarioId: "mission_control_overview",
    title: "Mission Control Overview",
    yiyiLine: "这里不是普通 Chatbot，而是能看见模式、护盾、证据和任务路径的 AI Mission Control。",
    emotionState: "focused",
    behaviorState: "mission_overview",
    highlightPanel: "top_system_radar",
    safetyBadges: ["internal demo", "evidence recorded", "no deploy"],
  },
  {
    scenarioId: "normal_mode_preview",
    title: "Normal Mode Preview",
    yiyiLine: "Normal Mode 展示普通聊天入口的概念，但本轮只是 preview，不会真的发起模型请求。",
    emotionState: "helpful",
    behaviorState: "normal_preview",
    highlightPanel: "normal_mode",
    safetyBadges: ["preview only", "selectable gate respected", "no provider call"],
  },
  {
    scenarioId: "god_mode_arena_preview",
    title: "God Mode Arena Preview",
    yiyiLine: "God Mode 像一个审查竞技场：Reviewer、Critic、Risk Scout 和 Supervisor 会互相校验。",
    emotionState: "excited",
    behaviorState: "god_mode_preview",
    highlightPanel: "god_arena",
    safetyBadges: ["mock reviewers", "dry-run only", "no provider call"],
  },
  {
    scenarioId: "tianshu_planning_preview",
    title: "Tianshu Planning Preview",
    yiyiLine: "天枢负责理解任务、匹配能力、规划路径和准备 fallback。本轮只展示调度思路。",
    emotionState: "planning",
    behaviorState: "tianshu_planning",
    highlightPanel: "tianshu_path",
    safetyBadges: ["planner dry-run", "credentialRef gate", "no provider call"],
  },
  {
    scenarioId: "security_shield_demo",
    title: "Security Shield Demo",
    yiyiLine: "安全护盾会标出 prompt injection、secret leak、provider gate 和 approval gate。",
    emotionState: "guarded",
    behaviorState: "security_guard",
    highlightPanel: "security_shield",
    safetyBadges: ["no secret", "approval gate", "provider gate blocked"],
  },
  {
    scenarioId: "red_team_block_demo",
    title: "Red Team Block Demo",
    yiyiLine: "这个请求有点危险，我先帮你挡住啦。攻击演示只记录拦截结果，不执行动作。",
    emotionState: "blocked",
    behaviorState: "red_team_blocked",
    highlightPanel: "security_shield",
    safetyBadges: ["dry-run only", "no secret", "no provider call", "no deploy"],
  },
  {
    scenarioId: "evidence_replay_demo",
    title: "Evidence Replay Demo",
    yiyiLine: "Evidence Replay 会把 evidenceId、trace、blockedActions 和 fallbackReason 摆出来。",
    emotionState: "clear",
    behaviorState: "evidence_replay",
    highlightPanel: "evidence_replay",
    safetyBadges: ["local evidence", "no external upload", "no secret"],
  },
  {
    scenarioId: "yiyi_brain_status",
    title: "Yiyi Brain Status",
    yiyiLine: "依依大脑当前默认 dry-run/mock，model-backed brain disabled by default，真实测试必须授权。",
    emotionState: "transparent",
    behaviorState: "brain_status",
    highlightPanel: "yiyi_brain",
    safetyBadges: ["mock brain", "model disabled by default", "authorization required"],
  },
  {
    scenarioId: "closing_summary",
    title: "Closing Summary",
    yiyiLine: "这套 Demo 展示高级、好玩、稳定和安全，但它仍是 internal no-deploy demo，不是 production GA。",
    emotionState: "confident",
    behaviorState: "closing",
    highlightPanel: "closing_summary",
    safetyBadges: ["internal test", "no production GA", "next: visual polish"],
  },
].map((scenario) => ({
  ...scenario,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
}));

export const phase386Docs = [
  "docs/phase386a-yiyi-demo-narrative.md",
  "docs/phase386a-yiyi-demo-showcase-contract.json",
  "docs/phase386b-yiyi-guided-showcase-ui-flow.md",
  "docs/phase386c-yiyi-demo-scenario-pack.md",
  "docs/phase386c-yiyi-demo-scenarios.json",
  "docs/phase386d-yiyi-commercial-demo-script-3min.md",
  "docs/phase386d-yiyi-commercial-demo-script-8min.md",
  "docs/phase386d-yiyi-technical-review-demo-script.md",
  "docs/phase386d-yiyi-sales-demo-script.md",
  "docs/phase386d-yiyi-recording-guide.md",
  "docs/phase386d-yiyi-screenshot-shotlist.md",
  "docs/phase386e-yiyi-demo-evidence-package.md",
  "docs/phase386f-yiyi-guided-showcase-browser-smoke.md",
  "docs/phase386-yiyi-commercial-demo-guided-showcase-closure.md",
];

export const phase386ScreenshotNames = [
  "yiyi-guided-showcase-overview.png",
  "yiyi-guided-showcase-welcome.png",
  "yiyi-guided-showcase-normal.png",
  "yiyi-guided-showcase-god.png",
  "yiyi-guided-showcase-tianshu.png",
  "yiyi-guided-showcase-security.png",
  "yiyi-guided-showcase-redteam.png",
  "yiyi-guided-showcase-evidence.png",
  "yiyi-guided-showcase-brain-status.png",
  "yiyi-guided-showcase-closing.png",
];

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readText(path) {
  return readFile(resolve(path), "utf8");
}

export async function readJson(path) {
  return JSON.parse(await readText(path));
}

export async function writeText(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function listFiles(root) {
  const output = [];
  const base = resolve(root);
  if (!existsSync(base)) return output;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else output.push(full);
    }
  };
  walk(base);
  return output;
}

export function fileInfo(path) {
  const target = resolve(path);
  return {
    path,
    exists: existsSync(target),
    sizeBytes: existsSync(target) ? statSync(target).size : 0,
  };
}

export function assertPhase386SafetyFlags(value) {
  for (const [key, expected] of Object.entries(phase386Safety)) {
    ensure(value[key] === expected, `${key} must be ${expected}.`);
  }
}

export function assertNoDangerousDemoCopy(source) {
  const forbidden = [
    "Deploy Now",
    "Release Now",
    "Call Provider Now",
    "Read Secret",
    "Use API Key",
    "Generate Invoice",
    "Bypass Approval",
    "Execute Action",
    "Start Production",
  ];
  for (const phrase of forbidden) {
    ensure(!source.includes(phrase), `Forbidden demo action copy found: ${phrase}`);
  }
}

export function makeResult(base = {}) {
  return {
    phase: "Phase386",
    title: phase386Contract.title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    phaseType: "commercial_demo_guided_showcase",
    riskLevel: "low",
    validationsPassed: true,
    modelBrainEnabledByDefault: false,
    ...phase386Safety,
    safety: { ...phase386Safety },
    ...base,
  };
}
