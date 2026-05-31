import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export const defaultReportPaths = Object.freeze({
  markdown: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.md",
  html: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.html",
});

export const ownerAutomationFileActionEvidencePath =
  "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json";

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readOwnerFileActionReportLine() {
  try {
    const evidence = JSON.parse(readFileSync(repoPath(ownerAutomationFileActionEvidencePath), "utf8"));
    if (
      evidence.completed === true &&
      evidence.desktopSpreadsheetCreated === true &&
      evidence.createdFilePathOnDesktop === true &&
      evidence.noExistingFileOverwritten === true &&
      typeof evidence.actualCreatedPath === "string" &&
      evidence.actualCreatedPath.length > 0
    ) {
      const fileName = basename(evidence.actualCreatedPath);
      return `小天已经帮你建好桌面表格：${fileName}。打开桌面上的表格，继续填写你的任务。`;
    }
  } catch {
    return null;
  }
  return null;
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

function yesNo(value) {
  return value ? "是" : "否";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function ownerNextAction(context) {
  if (context.blocker) return "把错误报告发给 Codex 修复";
  if (context.hasBlockingProblem) return "重新运行一键检查";
  if (context.ownerFeedbackNeeded) return "填写反馈";
  return "继续使用";
}

export function buildOwnerDailyReport(context = {}) {
  const completedItems = [
    `本地系统是否打开：${yesNo(context.localServiceDetected)}`,
    `浏览器是否自动打开：${yesNo(context.browserLaunched)}`,
    `老板模式是否可见：${yesNo(context.bossModeVisible)}`,
    `主按钮是否可点击：${yesNo(context.bossModeAutoClicked)}`,
    "有没有调用真实模型：没有调用",
    `有没有发现安全风险：${context.securityRiskFound ? "发现风险，需要 Codex 检查" : "没有发现安全风险"}`,
  ];
  const ownerFileActionReportLine = readOwnerFileActionReportLine();
  if (ownerFileActionReportLine) completedItems.push(ownerFileActionReportLine);

  const problemItems = context.hasBlockingProblem
    ? [
        context.ownerReadableProblem ?? "发现本地检查未完成，需要把错误报告发给 Codex 修复。",
        "本轮没有调用真实模型，也没有部署或发布。",
      ]
    : [
        "没有发现阻塞问题。",
        "本轮没有调用真实模型，没有读取密钥，没有部署或发布。",
      ];

  const nextAction = ownerNextAction(context);
  const nextItems = [nextAction];

  const advancedItems = [
    `详细记录：${context.evidencePath ?? "apps/ai-gateway-service/evidence/phase1781_1800"}`,
    `截图：${context.screenshotPath ?? ""}`,
    `日志：${context.logPath ?? ""}`,
    `检查结果：${context.verifierResultPath ?? ""}`,
  ];

  const markdown = `# 今日小天老板日报

## 一、今天完成了什么
${list(completedItems)}

## 二、发现了什么问题
${list(problemItems)}

## 三、下一步我该做什么
${list(nextItems)}

## 四、高级信息
${list(advancedItems)}
`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>今日小天老板日报</title>
  <style>
    :root { color-scheme: dark; --ink: #f5f8ff; --muted: #aab8d0; --line: rgb(164 188 224 / 24%); --surface: rgb(14 26 47 / 92%); --accent: #7dd3fc; --radius: 8px; }
    * { box-sizing: border-box; }
    body { font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif; margin: 0; background: radial-gradient(circle at 80% 0%, rgb(56 189 248 / 18%), transparent 32%), linear-gradient(145deg, #08111f, #101c31 60%, #091320); color: var(--ink); }
    main { max-width: 960px; margin: 0 auto; padding: 34px 20px 56px; }
    header { border: 1px solid var(--line); border-radius: var(--radius); background: linear-gradient(180deg, rgb(255 255 255 / 10%), rgb(255 255 255 / 5%)); padding: 22px; box-shadow: 0 24px 80px rgb(0 0 0 / 34%); }
    h1 { font-size: 32px; line-height: 1.2; margin: 0; }
    .lead { margin: 10px 0 0; color: var(--muted); line-height: 1.7; }
    .report-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .report-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; min-height: 180px; }
    h2 { font-size: 18px; line-height: 1.35; margin: 0 0 12px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 8px 0; line-height: 1.65; color: var(--muted); }
    details { margin-top: 14px; background: rgb(14 26 47 / 80%); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 20px; }
    summary { cursor: pointer; font-weight: 800; color: var(--ink); }
    .done { border-color: rgb(134 239 172 / 30%); }
    .problems { border-color: rgb(252 211 77 / 32%); }
    .next { border-color: rgb(125 211 252 / 42%); box-shadow: inset 4px 0 0 var(--accent); }
    @media (max-width: 760px) { .report-grid { grid-template-columns: 1fr; } h1 { font-size: 24px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>今日小天老板日报</h1>
      <p class="lead">这份报告只说三件事：今天完成了什么、发现了什么问题、下一步做什么。高级记录放在底部。</p>
    </header>
    <div class="report-grid">
    <section class="report-card done">
      <h2>一、今天完成了什么</h2>
      <ul>${completedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <section class="report-card problems">
      <h2>二、发现了什么问题</h2>
      <ul>${problemItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <section class="report-card next">
      <h2>三、下一步我该做什么</h2>
      <ul>${nextItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    </div>
    <details>
      <summary>四、高级信息</summary>
      <ul>${advancedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </details>
  </main>
</body>
</html>`;

  return {
    markdown,
    html,
    nextAction,
    completedItems,
    problemItems,
    advancedItems,
  };
}

export async function generateOwnerDailyReport(context = {}, paths = defaultReportPaths) {
  const report = buildOwnerDailyReport(context);
  await writeText(paths.markdown, report.markdown);
  await writeText(paths.html, report.html);
  return {
    ...report,
    markdownPath: paths.markdown,
    htmlPath: paths.html,
  };
}

async function main() {
  const inputPath = process.argv.find((arg) => arg.startsWith("--input="))?.slice("--input=".length);
  const input = inputPath
    ? JSON.parse(await readFile(repoPath(inputPath), "utf8"))
    : {};
  const report = await generateOwnerDailyReport(input);
  console.log(JSON.stringify({
    ownerDailyReportGenerated: true,
    reportPath: report.markdownPath,
    reportHtmlPath: report.htmlPath,
    nextAction: report.nextAction,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
