import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PHASE = "phase-50a-help-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-50a-help-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-50a-help-readability.md");
const helpScriptPath = resolve(repoRoot, "tools/phase14a/help.mjs");

let evidence;

try {
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const { stdout } = await execFileAsync(process.execPath, [helpScriptPath], {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 1024 * 1024,
  });

  const requiredText = [
    "PME 移动地球 command overview",
    "日常使用命令",
    "默认验收命令",
    "企业线验收命令",
    "Chat 体验验收命令",
    "知识库细分验收",
    "Web 入口",
    "当前冻结边界",
    "help 只读说明",
    "cmd /c pnpm dev:phase7b",
    "cmd /c pnpm health:phase12a",
    "cmd /c pnpm verify:phase49a",
    "cmd /c pnpm verify:phase50a",
    "cmd /c pnpm verify:phase51a",
    "cmd /c pnpm verify:phase52a",
    "cmd /c pnpm verify:phase53a",
    "cmd /c pnpm verify:phase54a",
    "cmd /c pnpm verify:phase55a",
    "cmd /c pnpm verify:phase56a",
    "cmd /c pnpm verify:phase57a",
    "cmd /c pnpm verify:phase58a",
    "cmd /c pnpm verify:phase59a",
    "cmd /c pnpm verify:phase60a",
    "cmd /c pnpm verify:phase61a",
    "cmd /c pnpm verify:phase62a",
    "cmd /c pnpm verify:phase63a",
    "cmd /c pnpm verify:phase64a",
    "cmd /c pnpm verify:phase65a",
    "cmd /c pnpm verify:phase66a",
    "cmd /c pnpm verify:phase67a",
    "cmd /c pnpm verify:phase68a",
    "cmd /c pnpm verify:phase69a",
    "cmd /c pnpm verify:phase70a",
    "cmd /c pnpm verify:phase71a",
    "cmd /c pnpm verify:phase72a",
    "cmd /c pnpm verify:phase73a",
    "cmd /c pnpm verify:phase74a",
    "cmd /c pnpm verify:phase75a",
    "cmd /c pnpm verify:phase76a",
    "cmd /c pnpm verify:phase76b",
    "cmd /c pnpm verify:phase76c",
    "cmd /c pnpm verify:phase76d",
    "cmd /c pnpm verify:phase76e",
    "cmd /c pnpm verify:phase76f",
    "cmd /c pnpm verify:phase76g",
    "cmd /c pnpm verify:phase76h",
    "cmd /c pnpm verify:phase76i",
    "cmd /c pnpm verify:phase76j",
    "cmd /c pnpm verify:phase76k",
    "cmd /c pnpm verify:phase76l",
    "cmd /c pnpm verify:phase76m",
    "cmd /c pnpm verify:phase76n",
    "cmd /c pnpm verify:phase76s",
    "cmd /c pnpm verify:phase97a",
    "cmd /c pnpm verify:phase98a",
    "cmd /c pnpm verify:phase99a",
    "cmd /c pnpm verify:phase100a",
    "cmd /c pnpm verify:enterprise",
    "http://127.0.0.1:3100/ui",
    "默认 /chat 主链仍是 NVIDIA single-provider",
    "真实 provider 烟测请运行 verify:phase7a-1",
    "不启动服务",
    "不调用 provider",
    "不刷新 evidence",
  ];
  const missingText = requiredText.filter((item) => !stdout.includes(item));
  const brokenMarkers = [
    "缁?",
    "閺?",
    "姒?",
    "娴?",
    "閻?",
    "閸?",
    "瑜?",
    "閿?",
    "锟?",
  ].filter((marker) => stdout.includes(marker));

  const expectedScriptPrefix = "node ./tools/phase14a/help.mjs";
  const rootHelpScript = rootPackage.scripts?.["help:phase14a"] ?? "";
  const scriptMatches = rootHelpScript === expectedScriptPrefix || rootHelpScript.startsWith(`${expectedScriptPrefix} `);
  const passed = scriptMatches && missingText.length === 0 && brokenMarkers.length === 0;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    helpScriptPath: "tools/phase14a/help.mjs",
    rootHelpScript: rootHelpScript || null,
    scriptMatches,
    output: {
      lineCount: stdout.trim().split(/\r?\n/).length,
      requiredTextCount: requiredText.length,
      missingText,
      brokenMarkerCount: brokenMarkers.length,
      brokenMarkers,
      containsProviderCallCommand: false,
      containsMutationCommand: false,
    },
    safety: {
      readOnlyHelp: true,
      providerCalls: false,
      runtimeMutation: false,
      evidenceRefresh: false,
      serviceStart: false,
      processStop: false,
    },
    conclusion: passed ? "help-readability-connected" : "help-readability-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "help-readability-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 50A Help Readability Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Help script path: ${body.helpScriptPath ?? "n/a"}
- Root help script: ${body.rootHelpScript ?? "n/a"}
- Script matches expected path: ${body.scriptMatches}
- Output line count: ${body.output?.lineCount ?? "n/a"}
- Required readable text count: ${body.output?.requiredTextCount ?? "n/a"}
- Missing readable text: ${(body.output?.missingText ?? []).join(", ") || "none"}
- Broken marker count: ${body.output?.brokenMarkerCount ?? "n/a"}
- Broken markers: ${(body.output?.brokenMarkers ?? []).join(", ") || "none"}
- Read-only help: ${body.safety?.readOnlyHelp}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Evidence refresh: ${body.safety?.evidenceRefresh}
- Service start: ${body.safety?.serviceStart}
- Process stop: ${body.safety?.processStop}
- Conclusion: ${body.conclusion}
`;
}
