import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const servicePackagePath = path.join(repoRoot, "apps", "ai-gateway-service", "package.json");
const inventoryPath = path.join(repoRoot, "docs", "phase323c-script-entrypoint-inventory.json");
const governancePath = path.join(repoRoot, "docs", "phase323c-script-governance-policy.md");
const serviceIndexPath = path.join(repoRoot, "docs", "phase323c-service-recommended-command-index.md");
const servicePolicyPath = path.join(repoRoot, "docs", "phase323c-service-command-governance-policy.md");

function pickExisting(items = [], scripts = {}) {
  return items.filter((name) => Object.prototype.hasOwnProperty.call(scripts, name));
}

function section(title, items) {
  return [
    `## ${title}`,
    "",
    ...(items.length ? items.map((item) => `- \`${item}\``) : ["- none"]),
    "",
  ].join("\n");
}

async function main() {
  const [servicePackageRaw, inventoryRaw, governanceRaw] = await Promise.all([
    readFile(servicePackagePath, "utf8"),
    readFile(inventoryPath, "utf8"),
    readFile(governancePath, "utf8"),
  ]);

  const servicePackage = JSON.parse(servicePackageRaw);
  const inventory = JSON.parse(inventoryRaw);
  const serviceScripts = servicePackage.scripts || {};

  const dailyCore = pickExisting(["check", "build", "start"], serviceScripts);
  const workbenchRegression = pickExisting([
    "verify:phase321a-workbench-product-recovery",
    "verify:phase322a-workbench-chat-gateway-real-nvidia",
    "verify:phase319a-functional-landing",
  ], serviceScripts);
  const modelLibrary = pickExisting([
    "verify:phase313a-model-usability-matrix",
    "verify:phase312a-unified-model-library",
    "verify:phase314a-chat-gateway-task-closure",
  ], serviceScripts);
  const safety = pickExisting(["verify:phase107a-secret-safety"], serviceScripts);
  const historicalCompatible = pickExisting(
    inventory.scriptInventory?.service?.["historical-compatible"]?.items?.slice(0, 20) || [],
    serviceScripts,
  );
  const archiveCandidates = pickExisting(
    inventory.scriptInventory?.service?.["archive-candidate"]?.items?.slice(0, 20) || [],
    serviceScripts,
  );
  const forbiddenDangerous = pickExisting(
    inventory.scriptInventory?.service?.["forbidden-touch"]?.items || [],
    serviceScripts,
  );

  const indexMarkdown = [
    "# Phase323C Service Recommended Command Index",
    "",
    "以下命令面向 `apps/ai-gateway-service` 包级日常使用，当前阶段只做推荐入口整理，不删除任何 service scripts，不移动任何 entrypoints。",
    "",
    section("Service Daily Core Commands", dailyCore),
    section("Service Workbench Regression Commands", workbenchRegression),
    section("Service Model Library Commands", modelLibrary),
    section("Service Safety Commands", safety),
    section("Service Historical-Compatible Commands", historicalCompatible),
  ].join("\n");

  const governanceMarkdown = [
    "# Phase323C Service Command Governance Policy",
    "",
    "本文件只定义 `apps/ai-gateway-service` package scripts 的推荐入口分层，不删除任何既有 scripts，不移动任何 entrypoints。",
    "",
    section("Service Daily Core Commands", dailyCore),
    section("Service Workbench Regression Commands", workbenchRegression),
    section("Service Model-Library Commands", modelLibrary),
    section("Service Safety Commands", safety),
    section("Service Historical-Compatible Commands", historicalCompatible),
    section("Service Archive-Candidate Policy", archiveCandidates),
    section("Forbidden-Dangerous Policy", forbiddenDangerous),
    "## Notes",
    "",
    `- governance source refreshed from \`${path.relative(repoRoot, governancePath)}\``,
    `- inventory source refreshed from \`${path.relative(repoRoot, inventoryPath)}\``,
    "- 本阶段不删除 service scripts，不移动 entrypoints。",
    "",
  ].join("\n");

  await Promise.all([
    writeFile(serviceIndexPath, indexMarkdown, "utf8"),
    writeFile(servicePolicyPath, governanceMarkdown, "utf8"),
  ]);

  process.stdout.write(JSON.stringify({
    status: "pass",
    serviceIndexPath,
    servicePolicyPath,
    serviceScriptCount: Object.keys(serviceScripts).length,
  }, null, 2) + "\n");
}

main().catch((error) => {
  console.error("[phase323c] failed to build service command index:", error.message);
  process.exitCode = 1;
});
