import { ensure, phase380Safety, readScenarioLines, scenarioLinesPath, scenarioSchemaPath, fileExists, writeArtifacts } from "../phase380-common.mjs";

const lines = await readScenarioLines();
const requiredScenarios = [
  "welcome",
  "onboarding_started",
  "onboarding_completed",
  "normal_mode_selected",
  "god_mode_selected",
  "tianshu_mode_selected",
  "security_guard",
  "red_team_blocked",
  "provider_unconfigured",
  "evidence_replay_opened",
  "dry_run_completed",
  "fallback_sorry",
  "compact_mode",
  "reduced_motion_enabled",
  "concept_preview_opened",
];

ensure(fileExists(scenarioSchemaPath), "Missing scenario line schema.");
ensure(fileExists(scenarioLinesPath), "Missing scenario line library.");
for (const scenario of requiredScenarios) {
  ensure(lines.some((item) => item.scenarioId === scenario), `Missing scenario line: ${scenario}`);
}
ensure(lines.every((item) => item.providerCallsMade === false), "Scenario lines must not imply provider calls.");
ensure(lines.every((item) => item.secretValueExposed === false), "Scenario lines must not expose secrets.");
ensure(lines.every((item) => Array.isArray(item.lines) && item.lines.length > 0), "Each scenario needs lines.");
const spokenLines = lines.flatMap((item) => item.lines).join("\n");
ensure(!spokenLines.includes("我已经部署"), "Scenario spoken lines must not claim deploy.");
ensure(!spokenLines.includes("我读取了你的密钥"), "Scenario spoken lines must not claim secret read.");

const result = {
  phase: "Phase380C",
  scenarioLineLibraryCreated: true,
  scenarioCount: lines.length,
  requiredScenarioCount: requiredScenarios.length,
  ...phase380Safety,
  validationPassed: true,
};

await writeArtifacts({
  reportPath: "docs/phase380c-yiyi-scenario-line-library.md",
  resultPath: "apps/ai-gateway-service/evidence/phase380c/yiyi-scenario-lines-result.json",
  result,
  reportLines: [
    "# Phase380C Yiyi Scenario Line Library",
    "",
    "- Added scenario line schema and 15 scenario line entries.",
    "- Lines are short, gentle, and do not claim real execution.",
    "- Provider calls and secret exposure remain false in every line.",
  ],
});

console.log(JSON.stringify(result, null, 2));
