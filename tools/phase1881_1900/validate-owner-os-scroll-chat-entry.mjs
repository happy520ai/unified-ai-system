import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const evidencePath = "apps/ai-gateway-service/evidence/phase1881_1900/phase1890-owner-os-scroll-chat-entry-static-validation.json";

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function countMatches(text, pattern) {
  return [...String(text).matchAll(pattern)].length;
}

async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function writeJson(relativePath, data) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function validateOwnerOsScrollChatEntry() {
  const html = createConsolePage();
  const ownerStart = html.indexOf('data-owner-os-shell="true"');
  const inputIndex = html.indexOf('id="owner-task-input"', ownerStart);
  const advancedStart = html.indexOf('id="owner-advanced-system-details"', ownerStart);
  const ownerHtml = ownerStart >= 0 ? html.slice(Math.max(0, html.lastIndexOf("<section", ownerStart)), advancedStart > ownerStart ? advancedStart : undefined) : "";
  const consolePage = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const ownerTheme = await readText("apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js");
  const taskInput = await readText("apps/ai-gateway-service/src/ui/components/OwnerTaskInput.js");
  const copy = await readText("apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js");

  const checks = {
    ownerOsShellPresent: ownerHtml.includes('data-owner-os-shell="true"'),
    firstScreenTaskInputVisible: ownerHtml.includes('id="owner-task-input"') &&
      ownerHtml.includes('data-owner-task-input="true"') &&
      ownerHtml.includes("今天让小天帮你做什么？"),
    inputPlaceholderPlainChinese: ownerHtml.includes("例如：帮我检查今天系统状态，或者输入你想让小天处理的任务"),
    inputNotHiddenBehindAdvancedMode: ownerStart >= 0 && inputIndex > ownerStart && advancedStart > inputIndex,
    ownerCanFindWhereToType: ownerHtml.includes("输入后按 Enter，或点击下面主按钮。"),
    primaryCtaCountOne: countMatches(ownerHtml, /data-owner-boss-action=/g) === 1,
    primaryCtaLooksLikeStart: ownerHtml.includes("让小天开始处理"),
    buttonFeedbackVisible: ownerHtml.includes('id="owner-boss-view-feedback"') &&
      consolePage.includes("小天正在处理") &&
      consolePage.includes("已完成本地检查") &&
      consolePage.includes("结果已生成") &&
      consolePage.includes("下一步看这里"),
    enterKeySubmitWired: consolePage.includes('byId("owner-task-input")?.addEventListener("keydown"') &&
      consolePage.includes('event.key === "Enter"') &&
      consolePage.includes("handleOwnerTaskInputSubmit"),
    bodyScrollUsable: /body \{ overflow-y: auto; overflow-x: hidden; \}/.test(consolePage),
    shellDoesNotTrapOverflow: ownerTheme.includes(".owner-os-shell") && ownerTheme.includes("overflow: visible"),
    taskInputComponentExists: existsSync(repoPath("apps/ai-gateway-service/src/ui/components/OwnerTaskInput.js")) &&
      taskInput.includes("renderOwnerTaskInput"),
    threeResultCardsVisible: ["today-completed", "problems-found", "next-action"].every((id) => ownerHtml.includes(`data-owner-summary-card="${id}"`)),
    bossDailyReportEntryVisible: ownerHtml.includes('data-owner-daily-report="true"'),
    advancedModeCollapsedByDefault: html.includes('id="owner-advanced-system-details"') &&
      !/<details[^>]+id="owner-advanced-system-details"[^>]*open/i.test(html),
    engineeringJargonHiddenFromOwner: !/(Phase\d+|\bverifier\b|\btrace\b|raw evidence path|CredentialRef|Provider Gate|\bDOM\b|\bJSON\b|token budget|regression matrix)/i.test(ownerHtml),
    noRemoteFontUsed: !/(https?:\/\/|cdn\.|@import\s+url|fonts\.googleapis|fonts\.gstatic)/i.test([consolePage, ownerTheme, copy].join("\n")),
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const result = {
    phase: "Phase1890",
    phaseRange: "Phase1881-1900AIO",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    scrollWorksStaticGuardReady: checks.bodyScrollUsable && checks.shellDoesNotTrapOverflow,
    firstScreenTaskInputVisible: checks.firstScreenTaskInputVisible,
    ownerCanFindWhereToType: checks.ownerCanFindWhereToType,
    inputPlaceholderPlainChinese: checks.inputPlaceholderPlainChinese,
    primaryCtaCount: checks.primaryCtaCountOne ? 1 : countMatches(ownerHtml, /data-owner-boss-action=/g),
    buttonFeedbackVisible: checks.buttonFeedbackVisible,
    checks,
  };
  await writeJson(evidencePath, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateOwnerOsScrollChatEntry();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
