import { verifyPersonalKnowledgePhase } from "./verifyPersonalKnowledgeClosureSupport.js";

await verifyPersonalKnowledgePhase({
  phase: "phase-249a-personal-knowledge-citation-report",
  docPath: "docs/PERSONAL_KNOWLEDGE_CITATION_REPORT.md",
  verifierPath: "apps/ai-gateway-service/src/entrypoints/verifyPersonalKnowledgeCitationReport.js",
  rootScriptName: "verify:phase249a-personal-knowledge-citation-report",
  serviceScriptValue: "node ./src/entrypoints/verifyPersonalKnowledgeCitationReport.js",
  requiredDocSections: [
    "# Personal Knowledge Citation Report",
    "## 2. Status Citation Sources",
    "## 3. Phase Evidence Citation Rules",
    "## 4. Docs Citation Rules",
    "## 5. README / AGENTS Citation Rules",
    "## 6. Codex Handoff / Review Citation Rules",
    "## 7. Missing Citation",
    "## 8. Stale Citation",
    "## 9. Forbidden Citation Conclusions",
  ],
  requiredDocMarkers: [
    "Every answer about current project state must explain what source it used.",
    "latest phase evidence",
    "final/closure docs",
    "Cite evidence path.",
    "Do not cite failed evidence as sealed.",
    "Do not treat handoff text as sealed fact.",
    "Do not allow no-source assertion of current status.",
    "Do not allow preview-only described as production-ready.",
  ],
  requiredUiMarkers: [
    "phase249a-personal-knowledge-citation-report",
    "Required citations",
    "Phase evidence citation",
    "Docs citation",
    "Handoff citation caution",
    "Missing citation means uncertain",
  ],
  requiredVerificationCommands: [
    "cmd /c pnpm run verify:phase249a-personal-knowledge-citation-report",
  ],
  requiredEvidenceStatusPaths: [
    "apps/ai-gateway-service/evidence/phase-248a-personal-knowledge-query-templates.json",
  ],
  conclusionPassed: "personal-knowledge-citation-report-preview-ready",
  conclusionFailed: "personal-knowledge-citation-report-preview-incomplete",
  capabilityList: [
    "knowledge-citation-report",
    "phase-evidence-citation-rules",
    "docs-citation-rules",
    "handoff-citation-caution",
    "missing-citation-uncertain",
  ],
  notes: [
    "Phase 249A requires source citation for project status answers.",
    "No-source assertions are marked uncertain instead of being treated as current state.",
  ],
});
