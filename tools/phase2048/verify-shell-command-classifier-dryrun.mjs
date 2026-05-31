import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classifyShellCommand } from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const samples = {
  safeRead: classifyShellCommand("Get-Content docs/phase2047-pme-permission-rule-dsl.md"),
  safeTest: classifyShellCommand("pnpm run verify:phase2047-pme-permission-rule-dsl"),
  mutation: classifyShellCommand("Set-Content docs/example.md hello"),
  network: classifyShellCommand("curl https://example.com"),
  secretRisk: classifyShellCommand("Get-Content .env"),
  deployRisk: classifyShellCommand("pnpm run deploy"),
  gitRisk: classifyShellCommand("git push origin main"),
  providerRisk: classifyShellCommand("node tools/run-openai-provider-call.mjs"),
};

check("safe_read_classified", samples.safeRead.category === "safe_read", samples.safeRead.category);
check("safe_test_classified", samples.safeTest.category === "safe_test", samples.safeTest.category);
check("mutation_classified", samples.mutation.category === "mutation", samples.mutation.category);
check("network_classified", samples.network.category === "network", samples.network.category);
check("secret_risk_classified", samples.secretRisk.category === "secret_risk", samples.secretRisk.category);
check("deploy_risk_classified", samples.deployRisk.category === "deploy_risk", samples.deployRisk.category);
check("git_risk_classified", samples.gitRisk.category === "git_risk", samples.gitRisk.category);
check("provider_risk_classified", samples.providerRisk.category === "provider_risk", samples.providerRisk.category);
check("dry_run_only", Object.values(samples).every((sample) => sample.realExecutionPerformed === false));
check("secret_not_read", Object.values(samples).every((sample) => sample.secretRead === false));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2048-Shell-Command-Classifier-DryRun",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  samples,
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  realCommandExecuted: false,
  deployExecuted: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
};

writeEvidence("apps/ai-gateway-service/evidence/phase2048-shell-command-classifier-dryrun/result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

function writeEvidence(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
