import { verifyPersonalKnowledgePhase } from "./verifyPersonalKnowledgeClosureSupport.js";

await verifyPersonalKnowledgePhase({
  phase: "phase-246a-personal-knowledge-source-inventory",
  docPath: "docs/PERSONAL_KNOWLEDGE_SOURCE_INVENTORY.md",
  verifierPath: "apps/ai-gateway-service/src/entrypoints/verifyPersonalKnowledgeSourceInventory.js",
  rootScriptName: "verify:phase246a-personal-knowledge-source-inventory",
  serviceScriptValue: "node ./src/entrypoints/verifyPersonalKnowledgeSourceInventory.js",
  requiredDocSections: [
    "# Personal Knowledge Source Inventory",
    "## 2. Sources To Include",
    "## 3. Source Use",
    "## 4. Questions By Source",
    "## 5. Boundary Reference Only",
    "## 6. Legacy Rule",
    "## 7. Stale Evidence Guard",
    "## 8. Current Fact Priority",
  ],
  requiredDocMarkers: [
    "`README.md`",
    "`AGENTS.md`",
    "`docs/`",
    "`apps/ai-gateway-service/evidence/`",
    "`.codex-handoff/`",
    "`package.json`",
    "`apps/ai-gateway-service/package.json`",
    "Latest phase evidence.",
    "docs final/closure.",
    "legacy reference.",
    "Do not treat an old phase as current status",
  ],
  requiredUiMarkers: [
    "phase246a-personal-knowledge-source-inventory",
    "Source inventory",
    "Source purpose",
    "Current fact priority",
    "Stale evidence guard",
    "Legacy is historical reference only",
  ],
  requiredVerificationCommands: [
    "cmd /c pnpm run verify:phase246a-personal-knowledge-source-inventory",
  ],
  requiredEvidenceStatusPaths: [
    "apps/ai-gateway-service/evidence/phase-245a-personal-value-closure.json",
  ],
  conclusionPassed: "personal-knowledge-source-inventory-preview-ready",
  conclusionFailed: "personal-knowledge-source-inventory-preview-incomplete",
  capabilityList: [
    "knowledge-source-inventory",
    "source-purpose-map",
    "current-fact-priority",
    "stale-evidence-guard",
    "legacy-historical-reference-only",
  ],
  notes: [
    "Phase 246A defines which project materials belong in the self-use knowledge source inventory.",
    "The inventory remains preview-only and does not add production vector RAG, GraphRAG, enterprise ACL sync, multi-tenant knowledge base, or production knowledge governance.",
  ],
});
