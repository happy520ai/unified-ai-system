#!/usr/bin/env node

import {
  PROMPT_ENHANCER_ENGINE,
  PROMPT_ENHANCER_VERSION,
  enhanceNaturalLanguagePrompt,
} from "../apps/ai-gateway-service/src/prompts/naturalLanguagePromptEnhancer.js";

const CASES = [
  {
    id: "english-auto-coding",
    input: "Build a small Docker API for my team and return JSON with tests.",
    profile: "auto",
    language: "auto",
    expectedProfile: "coding",
    expectedLanguage: "en",
    signals: ["format", "environment"],
  },
  {
    id: "chinese-auto-coding",
    input: "帮我开发一个 Node.js 接口，并补充测试和错误处理。",
    profile: "auto",
    language: "auto",
    expectedProfile: "coding",
    expectedLanguage: "zh-CN",
    signals: ["environment"],
  },
  {
    id: "english-analysis",
    input: "Compare these deployment options and explain the trade-offs.",
    profile: "analysis",
    language: "en",
    expectedProfile: "analysis",
    expectedLanguage: "en",
  },
  {
    id: "chinese-planning",
    input: "请为小型 API 的发布制定路线图和里程碑。",
    profile: "planning",
    language: "zh-CN",
    expectedProfile: "planning",
    expectedLanguage: "zh-CN",
  },
  {
    id: "english-writing",
    input: "Rewrite this release announcement for a technical developer audience.",
    profile: "writing",
    language: "en",
    expectedProfile: "writing",
    expectedLanguage: "en",
    signals: ["audience"],
  },
  {
    id: "english-research",
    input: "Research current sources and cite the evidence with links.",
    profile: "research",
    language: "en",
    expectedProfile: "research",
    expectedLanguage: "en",
    signals: ["evidence"],
  },
  {
    id: "explicit-general",
    input: "Summarize the key decisions from this request.",
    profile: "general",
    language: "en",
    expectedProfile: "general",
    expectedLanguage: "en",
  },
  {
    id: "all-request-signals",
    input:
      "Return JSON as a table for beginner users on Windows with Docker. You must cite the source, include a success criterion, and never omit the audience.",
    profile: "general",
    language: "en",
    expectedProfile: "general",
    expectedLanguage: "en",
    signals: ["format", "constraints", "audience", "success", "evidence", "environment"],
  },
  {
    id: "chinese-entity-and-deliverable-analysis",
    input: "用 Node.js 和 PostgreSQL 做一个订单查询 API，3 天内交付，返回 JSON",
    profile: "auto",
    language: "auto",
    expectedProfile: "coding",
    expectedLanguage: "zh-CN",
    expectedIntent: "create",
    entities: ["node.js", "postgresql"],
    deliverableExpected: true,
  },
  {
    id: "chinese-ambiguity-probes",
    input: "把这个弄好一点，再补一些日志",
    profile: "auto",
    language: "auto",
    expectedProfile: "general",
    expectedLanguage: "zh-CN",
    ambiguityKinds: ["reference", "quality", "quantity"],
  },
  {
    id: "agent-target-protocol",
    input: "帮我修复登录页面的 bug。",
    profile: "auto",
    language: "auto",
    target: "agent",
    expectedProfile: "coding",
    expectedLanguage: "zh-CN",
    expectedIntent: "modify",
    expectedSections: "context,execution,output,acceptance,agent",
  },
];

function evaluateCase(testCase) {
  const request = {
    input: testCase.input,
    profile: testCase.profile,
    language: testCase.language,
    ...(testCase.target ? { target: testCase.target } : {}),
  };
  const first = enhanceNaturalLanguagePrompt(request);
  const second = enhanceNaturalLanguagePrompt(request);
  const failures = [];

  if (first.original !== testCase.input) failures.push("original input changed");
  if (first.profile !== testCase.expectedProfile) {
    failures.push(`profile=${first.profile}, expected ${testCase.expectedProfile}`);
  }
  if (first.language !== testCase.expectedLanguage) {
    failures.push(`language=${first.language}, expected ${testCase.expectedLanguage}`);
  }
  if (!first.enhancedPrompt.includes(testCase.input)) {
    failures.push("enhanced prompt does not preserve original input");
  }
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    failures.push("repeated evaluation was not deterministic");
  }
  if (first.metadata.providerCalled !== false) failures.push("providerCalled was not false");
  if (first.metadata.credentialRequired !== false) {
    failures.push("credentialRequired was not false");
  }
  if (first.metadata.deterministic !== true) failures.push("deterministic was not true");
  if (first.metadata.target !== (testCase.target ?? "model")) {
    failures.push("metadata.target mismatch");
  }
  const expectedSections = testCase.expectedSections ?? "context,execution,output,acceptance";
  if (first.sections.map((section) => section.id).join(",") !== expectedSections) {
    failures.push("compiled section contract changed");
  }
  for (const signal of testCase.signals ?? []) {
    if (first.signals[signal] !== true) failures.push(`signal ${signal} was not detected`);
  }
  if (testCase.expectedIntent && first.analysis?.intent?.kind !== testCase.expectedIntent) {
    failures.push(`intent=${first.analysis?.intent?.kind}, expected ${testCase.expectedIntent}`);
  }
  for (const entity of testCase.entities ?? []) {
    if (!first.analysis?.entities?.technologies?.includes(entity)) {
      failures.push(`entity ${entity} was not detected`);
    }
  }
  if (testCase.deliverableExpected && !first.analysis?.deliverable) {
    failures.push("deliverable was not inferred");
  }
  for (const kind of testCase.ambiguityKinds ?? []) {
    if (!(first.analysis?.ambiguities ?? []).some((ambiguity) => ambiguity.kind === kind)) {
      failures.push(`ambiguity kind ${kind} was not detected`);
    }
  }

  return {
    id: testCase.id,
    profile: first.profile,
    language: first.language,
    passed: failures.length === 0,
    failures,
  };
}

const results = CASES.map(evaluateCase);
const failed = results.filter((result) => !result.passed);
const report = {
  evaluation: "prompt-enhancement-contract",
  engine: PROMPT_ENHANCER_ENGINE,
  version: PROMPT_ENHANCER_VERSION,
  caseCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  providerCalls: 0,
  deterministic: failed.length === 0,
  cases: results,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Prompt enhancement evaluation ${failed.length === 0 ? "passed" : "failed"}`);
  console.log(`- cases: ${report.passed}/${report.caseCount}`);
  console.log(`- engine: ${report.engine} (${report.version})`);
  console.log(`- provider calls: ${report.providerCalls}`);
  console.log(`- deterministic: ${report.deterministic ? "yes" : "no"}`);
  for (const result of failed) {
    console.log(`- ${result.id}: ${result.failures.join("; ")}`);
  }
}

if (failed.length > 0) process.exitCode = 1;
