import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const files = {
  threeModeCopy: "apps/ai-gateway-service/src/ui/copy/threeModeCopy.js",
  godModeCopy: "apps/ai-gateway-service/src/ui/copy/godModeCopy.js",
  tianshuCopy: "apps/ai-gateway-service/src/ui/copy/tianshuCopy.js",
  missionControl: "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  consolePage: "apps/ai-gateway-service/src/ui/consolePage.js",
  doc: "docs/phase569-low-risk-copy-and-button-confidence-repair.md",
  report: "docs/phase569-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase569/low-risk-copy-and-button-confidence-repair-result.json",
};

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return readFile(resolve(path), "utf8");
}

async function main() {
  const result = {
    phase: "Phase569",
    name: "Low-Risk Copy And Button Confidence Repair",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    exists: {},
  };

  try {
    for (const [key, path] of Object.entries(files)) {
      result.exists[key] = existsSync(resolve(path));
      ensure(result.exists[key], `Missing required file: ${path}`);
    }

    const threeModeCopy = await read(files.threeModeCopy);
    const godModeCopy = await read(files.godModeCopy);
    const tianshuCopy = await read(files.tianshuCopy);
    const missionControl = await read(files.missionControl);
    const consolePage = await read(files.consolePage);
    const docs = `${await read(files.doc)}\n${await read(files.report)}`;
    const evidence = JSON.parse(await read(files.evidence));

    ensure(threeModeCopy.includes("单模型直聊"), "Normal summary missing.");
    ensure(godModeCopy.includes("多模型互审"), "God summary missing.");
    ensure(tianshuCopy.includes("任务规划"), "Tianshu summary missing.");
    ensure(threeModeCopy.includes("预览普通模式结果"), "Normal preview button copy missing.");
    ensure(godModeCopy.includes("预览 God Mode 方案"), "God preview button copy missing.");
    ensure(tianshuCopy.includes("预览天枢规划"), "Tianshu preview button copy missing.");
    ensure(consolePage.includes("检查配置状态（不调用真实任务）"), "Provider config check copy missing.");
    ensure(consolePage.includes("批准此 dry-run 候选"), "Approval approve copy missing.");
    ensure(consolePage.includes("拒绝此 dry-run 候选"), "Approval reject copy missing.");
    ensure(consolePage.includes("预览已批准动作说明"), "Approval apply preview copy missing.");
    ensure(missionControl.includes("它保护什么"), "Security Shield user-view copy missing.");
    ensure(missionControl.includes("它不做什么"), "Security Shield non-claim copy missing.");

    ensure(evidence.completed === true, "Phase569 evidence must be completed.");
    ensure(evidence.recommended_sealed === true, "Phase569 evidence must be sealed.");
    ensure(evidence.runtimeBehaviorChanged === false, "Phase569 must not change runtime behavior.");
    ensure(evidence.providerCallsMade === false, "Phase569 providerCallsMade must be false.");
    ensure(evidence.secretValueExposed === false, "Phase569 secretValueExposed must be false.");
    ensure(evidence.deployExecuted === false, "Phase569 deployExecuted must be false.");
    ensure(evidence.billingExecuted === false, "Phase569 billingExecuted must be false.");
    ensure(evidence.invoiceGenerated === false, "Phase569 invoiceGenerated must be false.");
    ensure(evidence.chatGatewayRuntimeModified === false, "Phase569 must not modify chat gateway runtime.");

    for (const boundary of ["no-provider-call", "no-secret", "no-deploy", "no-billing", "no-invoice"]) {
      ensure(docs.includes(boundary), `Missing boundary term in docs: ${boundary}`);
    }
  } catch (error) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = String(error?.message || error);
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
