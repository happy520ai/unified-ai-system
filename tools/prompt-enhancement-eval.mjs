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
];

function evaluateCase(testCase) {
  const request = {
    input: testCase.input,
    profile: testCase.profile,
    language: testCase.language,
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
  if (first.sections.map((section) => section.id).join(",") !== "execution,output,acceptance") {
    failures.push("compiled section contract changed");
  }
  for (const signal of testCase.signals ?? []) {
    if (first.signals[signal] !== true) failures.push(`signal ${signal} was not detected`);
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
