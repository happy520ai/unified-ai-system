import { verifyPersonalKnowledgePhase } from "./verifyPersonalKnowledgeClosureSupport.js";

await verifyPersonalKnowledgePhase({
  phase: "phase-247a-personal-knowledge-starter-pack",
  docPath: "docs/PERSONAL_KNOWLEDGE_STARTER_PACK.md",
  verifierPath: "apps/ai-gateway-service/src/entrypoints/verifyPersonalKnowledgeStarterPack.js",
  rootScriptName: "verify:phase247a-personal-knowledge-starter-pack",
  serviceScriptValue: "node ./src/entrypoints/verifyPersonalKnowledgeStarterPack.js",
  requiredDocSections: [
    "# Personal Knowledge Starter Pack",
    "## 2. First Recommended Import Files",
    "## 3. Why These First",
    "## 4. Query Value By File",
    "## 5. Recommended Queries",
    "## 6. Not Recommended For First Import",
    "## 7. Noise Control",
    "## 8. Dirty Workspace Knowledge Updates",
    "## 9. Refresh After A Codex Round",
  ],
  requiredDocMarkers: [
    "`README.md`",
    "`AGENTS.md`",
    "`docs/PERSONAL_VALUE_CLOSURE_SNAPSHOT.md`",
    "latest evidence for phases 237A-245A",
    "`package.json`",
    "`apps/ai-gateway-service/package.json`",
    "Do not first-import",
    "Prefer latest evidence.",
    "Do not describe the workspace as clean.",
    "Refresh evidence only after it passes.",
  ],
  requiredUiMarkers: [
    "phase247a-personal-knowledge-starter-pack",
    "Starter files",
    "Why first",
    "Query value",
    "Noise control",
    "Dirty workspace refresh",
  ],
  requiredVerificationCommands: [
    "cmd /c pnpm run verify:phase247a-personal-knowledge-starter-pack",
  ],
  requiredEvidenceStatusPaths: [
    "apps/ai-gateway-service/evidence/phase-246a-personal-knowledge-source-inventory.json",
  ],
  conclusionPassed: "personal-knowledge-starter-pack-preview-ready",
  conclusionFailed: "personal-knowledge-starter-pack-preview-incomplete",
  capabilityList: [
    "knowledge-starter-pack",
    "first-import-file-list",
    "query-value-map",
    "noise-control",
    "dirty-workspace-refresh-rule",
  ],
  notes: [
    "Phase 247A defines the first small source pack for daily project knowledge questions.",
    "The starter pack is self-use preview guidance only and does not import broad legacy or secret-bearing files by default.",
  ],
});
