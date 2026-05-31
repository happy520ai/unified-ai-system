import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildLocalSelfUseV1ReadinessAudit } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildLocalSelfUseV1ReadinessAudit({
  supplemental: readJsonIfPresent(paths.supplementalSeal) || {},
  policy: readJsonIfPresent(paths.policySeal) || {},
  consoleSeal: readJsonIfPresent(paths.consoleSeal) || {},
  automation: readJsonIfPresent(paths.automationSeal) || {},
  soak: readJsonIfPresent(paths.soakSeal) || {},
  safety: readJsonIfPresent(paths.safetyRecheck) || {},
});
writeJson(paths.readinessAudit, result);
writeDoc("docs/phase971-1000/phase996-local-self-use-v1-readiness-audit.md", {
  title: "Phase996 Local Self-use v1 Readiness Audit",
  goal: "Audit supplemental closure, route policy design, console, automation, soak, and safety boundaries.",
  facts: [`recommended_sealed=${result.recommended_sealed}`, `localSelfUseV1ReadinessAuditReady=${result.localSelfUseV1ReadinessAuditReady}`],
  boundaries: ["Local self-use readiness only."],
  outputs: [paths.readinessAudit],
});
logResult(result);
