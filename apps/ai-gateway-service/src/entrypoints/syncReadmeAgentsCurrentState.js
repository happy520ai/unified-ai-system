import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { agentsBlock } from "./syncAgentsBlockData.js";
import { readmeBlock } from "./syncReadmeBlockData.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const readmePath = resolve(repoRoot, "README.md");
const agentsPath = resolve(repoRoot, "AGENTS.md");

const readmePreamble = [
  "# unified-ai-system / AI Gateway Workbench",
  "",
  "<p align=\"center\">",
  "  <strong>Build AI systems that can act, while keeping people in control.</strong>",
  "  <br />",
  "  An evidence-first, local-first workbench for models, agents, tools, and context.",
  "  <br />",
  "  面向模型、智能体、工具与上下文协同的可治理 AI 能力网关。",
  "</p>",
  "",
  "<p align=\"center\">",
  "  <img alt=\"Apache-2.0 license\" src=\"https://img.shields.io/badge/license-Apache--2.0-0B7285?style=flat-square\" />",
  "  <img alt=\"Node.js 20 or newer\" src=\"https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=nodedotjs&logoColor=white\" />",
  "  <img alt=\"pnpm 9.15.4\" src=\"https://img.shields.io/badge/pnpm-9.15.4-F69220?style=flat-square&logo=pnpm&logoColor=white\" />",
  "  <img alt=\"Local-first preview\" src=\"https://img.shields.io/badge/mode-local--first%20preview-2563EB?style=flat-square\" />",
  "  <img alt=\"Provider calls are gated\" src=\"https://img.shields.io/badge/provider%20calls-gated-7C3AED?style=flat-square\" />",
  "</p>",
  "",
  "<p align=\"center\">",
  "  <a href=\"#local-quick-start\">Quick start</a>",
  "  ·",
  "  <a href=\"#architecture\">Architecture</a>",
  "  ·",
  "  <a href=\"#trust-model\">Trust model</a>",
  "  ·",
  "  <a href=\"#engineering-status\">Engineering status</a>",
  "</p>",
  "",
  "> **Current status:** Public repo preflight status: dry-run / local preview / governance demo. Default: no real Provider calls. Users bringing their own API key remains a future controlled path, not the default clone path. This README makes no general availability claim and no deployment promise.",
  "",
  "> The hard part is not calling a model. It is controlling what happens next.",
  "",
  "Modern AI products need more than a prompt box. They need stable contracts,",
  "bounded execution, human approval, budget controls, failure recovery, and",
  "evidence that explains what actually happened. Unified AI System is an",
  "open-source engineering workbench for that control layer.",
  "",
  "The long-term direction is an enterprise AI capability gateway that can",
  "coordinate models, agents, tools, and organizational workflows without turning",
  "autonomy into an unauditable black box. The repository starts with the less",
  "glamorous parts that serious systems depend on: explicit boundaries, local",
  "verification, reversible operations, and honest maturity gates.",
  "",
  "## Why This Project",
  "",
  "| Capability plane | What it brings |",
  "| --- | --- |",
  "| **AI Gateway** | A shared service boundary for model access, adapters, contracts, configuration, and diagnostics. |",
  "| **Mission Control** | Operator-facing visibility for bounded workflows, workforce previews, approvals, and system state. |",
  "| **Governed execution** | Dry-run defaults, scoped authorization, file boundaries, budgets, rollback notes, and emergency stops. |",
  "| **Codex Context Gateway** | Targeted project context, relevant-file selection, freshness checks, prompt packs, and token-budget enforcement. |",
  "| **Evidence layer** | Verifiers and structured evidence that separate a passing command from a justified engineering claim. |",
  "",
  "This is designed for teams exploring AI infrastructure, agent orchestration,",
  "developer tooling, local AI operations, and governance-first automation. It is",
  "also a research surface for a practical question: how far can increasingly",
  "capable systems go while remaining inspectable and interruptible?",
  "",
  "## Architecture",
  "",
  "```mermaid",
  "flowchart LR",
  "    O[\"Operator or application\"] --> W[\"Workbench UI and API\"]",
  "    W --> G[\"AI Gateway service\"]",
  "    G --> P[\"Contracts, policy, approval, budget\"]",
  "    P --> X[\"Models, tools, and agents (gated)\"]",
  "    G --> M[\"Mission Control and Workforce dry-run\"]",
  "",
  "    R[\"Repository state and evidence\"] --> C[\"Codex Context Gateway\"]",
  "    C --> K[\"Bounded context and prompt packs\"]",
  "",
  "    G --> E[\"Evidence, diagnostics, and rollback\"]",
  "    C --> E",
  "```",
  "",
  "The runtime and context planes are intentionally bounded. The Codex Context",
  "Gateway is an independent context workflow, not a hidden connection to the main",
  "chat route or Provider runtime.",
  "",
  "## Repository Map",
  "",
  "```text",
  "apps/",
  "  agent-console/          Upper-level operator interaction",
  "  ai-gateway-service/     Gateway service and Workbench behavior",
  "  static-showcase/        Reference-only standalone UI prototype",
  "packages/",
  "  shared-contracts/       Public protocol types",
  "  shared-sdk/             Reusable clients and adapters",
  "  shared-config/          Shared configuration contracts and defaults",
  "  shared-utils/           Implementation-neutral helpers",
  "docs/                     Architecture, runbooks, and evidence guidance",
  "tools/                    Local verifiers and maintenance scripts",
  "```",
  "",
  "Focused migration is preferred over bulk copying. Historical sources, when",
  "present, remain read-only references.",
  "",
  "## Trust Model",
  "",
  "What the current repository supports:",
  "",
  "- local installation and local Workbench exploration;",
  "- credential-free first-run and fake-provider verification paths;",
  "- bounded dry-run workflows, diagnostics, and structured evidence;",
  "- approval-gated designs for higher-risk operations.",
  "",
  "What it does **not** currently claim:",
  "",
  "- production deployment or general availability;",
  "- enterprise L5 autonomy;",
  "- AGI or independently validated general intelligence;",
  "- permission to run real Provider calls by default.",
  "",
  "Ambition is welcome here, but claims must follow evidence. Local checks,",
  "readiness tooling, and architecture are reported separately from production,",
  "L5, and AGI milestones.",
  "",
  "Start with local dry-run checks only:",
  "",
  "```powershell",
  "cmd /c pnpm install",
  "cmd /c pnpm verify:phase606r-open-source-minimum-readiness-lock",
  "cmd /c pnpm verify:phase607r-public-repo-hygiene-preflight",
  "```",
  "",
  "Do not commit secrets, do not run real providers, and do not treat this repository as deployed production software.",
  "",
  "## Local Quick Start",
  "",
  "Use Node.js 22 (Node.js 20 or newer is supported) and pnpm 9.15.4. From a",
  "fresh clone:",
  "",
  "```powershell",
  "corepack enable",
  "pnpm install --frozen-lockfile",
  "pnpm start:ai-gateway-service",
  "```",
  "",
  "Open [http://127.0.0.1:3100/ui](http://127.0.0.1:3100/ui). The public-clone",
  "path is local-first:",
  "",
  "- use Chat only after the page reports an available model;",
  "- configure a model through the Models page without exposing credentials;",
  "- register non-sensitive files through the Files page;",
  "- exercise the Agent Workforce dry-run from Mission Control;",
  "- inspect failures and service status through Diagnostics.",
  "",
  "Keep the first run credential-free. The Phase 104A readiness check and Phase 105A",
  "ordinary-user journey both use local fake-provider boundaries:",
  "",
  "```powershell",
  "pnpm verify:phase104a-first-run-setup",
  "pnpm verify:phase105a-user-journey",
  "```",
  "",
  "These checks do not prove production readiness, L5 autonomy, or AGI.",
  "",
  "## Docker Compose Local Runtime",
  "",
  "Phase 116A verifies a local Compose build, service health, setup readiness, and",
  "the Workbench UI without making a Provider request. On Windows PowerShell:",
  "",
  "```powershell",
  "Copy-Item .env.example .env",
  "pnpm verify:phase116a-docker-compose-runtime",
  "```",
  "",
  "The verifier uses an isolated Compose project and tears it down after the",
  "checks. Keep port `3100` free while it runs. A passing local container check is",
  "not evidence of cloud deployment or production readiness.",
  "",
  "## Secret Safety",
  "",
  "Before publishing changes, run the Phase 107A compatibility gate:",
  "",
  "```powershell",
  "pnpm verify:phase107a-secret-safety",
  "```",
  "",
  "The gate scans the repository and runtime previews for plaintext credentials.",
  "It records only masked findings and must pass before secret-safety evidence is",
  "refreshed.",
  "",
  "Operational approvals and execution inputs are local-only. The repository tracks",
  "`*.input.example.json` and `*.input.template.json`, while real `*.input.json`",
  "files are ignored by both Git and Docker. Create an input locally only for the",
  "specific gated action you intend to authorize, then remove it when the action is",
  "complete.",
  "",
  "## Join the Work",
  "",
  "Thoughtful architecture critiques, focused bug reports, reproducible failure",
  "cases, and narrowly scoped pull requests are welcome. A useful contribution",
  "should improve product value or evidence quality without weakening approval,",
  "secret-safety, or rollback boundaries.",
  "",
  "- [Contributing guide](CONTRIBUTING.md)",
  "- [Security policy](SECURITY.md)",
  "- [Changelog](CHANGELOG.md)",
  "- [Open an issue](https://github.com/happy520ai/unified-ai-system/issues)",
  "",
  "Licensed under Apache-2.0.",
  "",
].join("\n");

const readmeStateStart = "<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->";
const readmeStateEnd = "<!-- END UNIFIED_AI_SYSTEM_CURRENT_STATE -->";
const readmeLedgerBody = readmeBlock
  .replace(`${readmeStateStart}\n`, "")
  .replace(`\n${readmeStateEnd}`, "");

const readmeStatusBlock = [
  readmeStateStart,
  "## Engineering Status",
  "",
  "The public README stays focused on the product. The generated phase ledger and",
  "complete safety boundary remain available below for maintainers and auditors.",
  "",
  "- Runtime posture: local-first.",
  "- Provider posture: fake/local by default; real calls remain explicitly gated.",
  "- Claim posture: no production, L5, or AGI claim.",
  "",
  "<details>",
  "<summary><strong>Open the full generated engineering ledger</strong></summary>",
  "",
  readmeLedgerBody,
  "",
  "</details>",
  readmeStateEnd,
].join("\n");

const summary = [];

await ensureReadmePreamble(readmePath);
await updateManagedBlock(readmePath, "UNIFIED_AI_SYSTEM_CURRENT_STATE", readmeStatusBlock, "## Layout\n");
summary.push("README.md managed block refreshed");

await updateManagedBlock(agentsPath, "UNIFIED_AI_SYSTEM_AGENT_RULES", agentsBlock, "## Current Local Operation Rules\n");
summary.push("AGENTS.md managed block refreshed");

console.log(JSON.stringify({
  status: "pass",
  updatedFiles: ["README.md", "AGENTS.md"],
  summary,
}, null, 2));

async function updateManagedBlock(filePath, blockName, blockContent, anchor) {
  const startMarker = `<!-- BEGIN ${blockName} -->`;
  const endMarker = `<!-- END ${blockName} -->`;
  const original = String(await readFile(filePath, "utf8")).replace(/\r\n/g, "\n");

  let next = original;
  const existingStart = original.indexOf(startMarker);
  const existingEnd = original.indexOf(endMarker);
  if (existingStart !== -1 && existingEnd !== -1 && existingEnd > existingStart) {
    next = `${original.slice(0, existingStart)}${blockContent}\n${original.slice(existingEnd + endMarker.length)}`;
  } else {
    const anchorIndex = original.indexOf(anchor);
    if (anchorIndex !== -1) {
      next = `${original.slice(0, anchorIndex)}${blockContent}\n\n${original.slice(anchorIndex)}`;
    } else {
      next = `${original}\n\n${blockContent}\n`;
    }
  }

  if (next !== original) {
    await writeFile(filePath, `${next.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`, "utf8");
  }
}

async function ensureReadmePreamble(filePath) {
  const original = String(await readFile(filePath, "utf8")).replace(/\r\n/g, "\n");
  const marker = "<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->";
  const markerIndex = original.indexOf(marker);
  if (markerIndex === -1) {
    if (original.startsWith(readmePreamble)) return;
    await writeFile(filePath, `${readmePreamble}\n${original.trimStart()}`, "utf8");
    return;
  }

  const next = `${readmePreamble}\n${original.slice(markerIndex).trimStart()}`;
  if (next !== original) {
    await writeFile(filePath, next, "utf8");
  }
}
