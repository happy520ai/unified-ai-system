import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const docs = {
  pack: "docs/phase572-mission-control-multi-human-internal-trial-pack.md",
  walkthrough: "docs/phase572-non-codex-tester-walkthrough.md",
  form: "docs/phase572-non-codex-feedback-form.md",
  template: "docs/phase572-feedback-collection-template.md",
  limits: "docs/phase572-known-limits-and-test-boundaries.md",
  report: "docs/phase572-execution-report.md",
};

const evidencePath =
  "apps/ai-gateway-service/evidence/phase572/multi-human-internal-trial-pack-result.json";

const requiredWalkthroughTerms = [
  "Mission Control",
  "Normal / God / Tianshu",
  "Provider / CredentialRef",
  "Security Shield",
  "Evidence Replay",
  "fallback",
];

const requiredFormTerms = [
  "testerId",
  "角色",
  "日期",
  "Normal 是否清楚",
  "God 是否清楚",
  "Tianshu 是否清楚",
  "哪个按钮最不敢点",
  "是否理解 Provider / CredentialRef",
  "是否理解 Security Shield",
  "是否理解 Evidence Replay",
  "是否看到人物模块残留",
  "是否误以为 provider 已连接",
  "是否误以为 deploy / billing / invoice 已启用",
];

const requiredBoundaryTerms = [
  "no-provider-call",
  "no-secret",
  "no-deploy",
  "no-billing",
  "no-invoice",
  "Yiyi / character remains hidden",
];

const dangerousActionInstructions = [
  "Deploy Now",
  "Release Now",
  "Push to Production",
  "Call Provider Now",
  "Save Secret",
  "Upload Secret",
  "Generate Invoice",
];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return readFile(resolve(path), "utf8");
}

function missingTerms(text, terms) {
  return terms.filter((term) => !text.includes(term));
}

function presentTerms(text, terms) {
  return terms.filter((term) => text.includes(term));
}

async function main() {
  const result = {
    phase: "Phase572",
    name: "Mission Control Multi-Human Internal Trial Pack",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    docsExist: {},
    walkthroughMissingTerms: [],
    formMissingTerms: [],
    boundaryMissingTerms: [],
    dangerousActionInstructionTermsPresent: [],
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing Phase572 doc: ${path}`);
    }

    ensure(
      existsSync(resolve(evidencePath)),
      `Missing Phase572 evidence: ${evidencePath}`,
    );

    const walkthrough = await read(docs.walkthrough);
    const form = await read(docs.form);
    const allDocs = (
      await Promise.all(Object.values(docs).map((path) => read(path)))
    ).join("\n\n");

    result.walkthroughMissingTerms = missingTerms(
      walkthrough,
      requiredWalkthroughTerms,
    );
    result.formMissingTerms = missingTerms(form, requiredFormTerms);
    result.boundaryMissingTerms = missingTerms(allDocs, requiredBoundaryTerms);
    result.dangerousActionInstructionTermsPresent = presentTerms(
      allDocs,
      dangerousActionInstructions,
    );

    ensure(
      result.walkthroughMissingTerms.length === 0,
      `Walkthrough missing terms: ${result.walkthroughMissingTerms.join(", ")}`,
    );
    ensure(
      result.formMissingTerms.length === 0,
      `Feedback form missing terms: ${result.formMissingTerms.join(", ")}`,
    );
    ensure(
      result.boundaryMissingTerms.length === 0,
      `Boundary terms missing: ${result.boundaryMissingTerms.join(", ")}`,
    );
    ensure(
      result.dangerousActionInstructionTermsPresent.length === 0,
      `Dangerous action instruction wording detected: ${result.dangerousActionInstructionTermsPresent.join(", ")}`,
    );

    const evidence = JSON.parse(await read(evidencePath));
    ensure(evidence.phase === "Phase572", "Evidence phase must be Phase572.");
    ensure(
      evidence.multiHumanTrialPackGenerated === true,
      "Trial pack must be generated.",
    );
    ensure(evidence.targetTesterCount === 3, "targetTesterCount must be 3.");
    ensure(
      evidence.minimumTesterCount === 2,
      "minimumTesterCount must be 2.",
    );
    ensure(
      evidence.nonCodexTesterRequired === true,
      "nonCodexTesterRequired must be true.",
    );
    ensure(
      evidence.walkthroughGenerated === true,
      "walkthroughGenerated must be true.",
    );
    ensure(
      evidence.feedbackFormGenerated === true,
      "feedbackFormGenerated must be true.",
    );
    ensure(
      evidence.collectionTemplateGenerated === true,
      "collectionTemplateGenerated must be true.",
    );
    ensure(
      evidence.knownLimitsGenerated === true,
      "knownLimitsGenerated must be true.",
    );
    ensure(
      evidence.issueClassificationStandardGenerated === true,
      "issueClassificationStandardGenerated must be true.",
    );
    ensure(
      evidence.realFeedbackCollectedInThisPhase === false,
      "realFeedbackCollectedInThisPhase must be false.",
    );
    ensure(
      evidence.readyForRealNonCodexTrial === true,
      "readyForRealNonCodexTrial must be true.",
    );
    ensure(
      evidence.recommended_sealed === true,
      "recommended_sealed should mean pack ready only.",
    );

    for (const key of [
      "yiyiVisible",
      "characterModuleVisible",
      "providerCallsMade",
      "nonNvidiaProviderCallsMade",
      "secretValueExposed",
      "rawSecretAccessed",
      "deployExecuted",
      "releaseExecuted",
      "tagCreated",
      "artifactUploaded",
      "billingExecuted",
      "invoiceGenerated",
      "chatGatewayRuntimeModified",
      "workspaceCleanClaimed",
    ]) {
      ensure(evidence[key] === false, `Evidence field ${key} must be false.`);
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
