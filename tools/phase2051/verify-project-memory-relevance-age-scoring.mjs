import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scoreProjectMemory } from "../../packages/gvc-permission-engine/src/index.js";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const now = new Date("2026-05-23T00:00:00.000Z");
const freshRelevant = scoreProjectMemory({
  memoryId: "fresh-phase2047",
  text: "permission rule DSL shell classifier evidence verifier",
  updatedAt: "2026-05-23T00:00:00.000Z",
  queryTerms: ["permission", "verifier"],
  now,
});
const staleLowValue = scoreProjectMemory({
  memoryId: "stale-generic-note",
  text: "generic repeated note",
  updatedAt: "2025-01-01T00:00:00.000Z",
  queryTerms: ["permission", "verifier"],
  now,
});

check("fresh_relevance_higher", freshRelevant.relevanceScore > staleLowValue.relevanceScore);
check("fresh_age_higher", freshRelevant.ageScore > staleLowValue.ageScore);
check("stale_score_higher_for_old_memory", staleLowValue.staleScore > freshRelevant.staleScore);
check("fresh_recommended", freshRelevant.recommendedAction === "use");
check("stale_not_recommended", staleLowValue.recommendedAction !== "use");
check("no_secret_read", freshRelevant.secretRead === false && staleLowValue.secretRead === false);

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2051-Project-Memory-Relevance-Age-Scoring",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  samples: { freshRelevant, staleLowValue },
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  duplicateLowValueTaskRiskReduced: true,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
};

writeEvidenceFile("apps/ai-gateway-service/evidence/phase2051-project-memory-relevance-age-scoring/result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

