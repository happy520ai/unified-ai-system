// =============================================================================
// promptManager.js — Prompt 管理系统
// 模板库、版本控制、A/B 测试、变量替换
// =============================================================================

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function createPromptManager(options = {}) {
  const dataDir = options.dataDir ?? resolve(process.cwd(), ".data/prompts");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const prompts = new Map(); // id -> { id, name, template, variables, versions, tags }
  const experiments = new Map(); // id -> { id, name, variants, traffic, results }

  function createPrompt(name, template, opts = {}) {
    const id = randomUUID().slice(0, 8);
    const prompt = {
      id, name, template,
      variables: extractVariables(template),
      versions: [{ version: 1, template, createdAt: Date.now(), changelog: "Initial" }],
      tags: opts.tags ?? [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    prompts.set(id, prompt);
    return prompt;
  }

  function updatePrompt(id, template, changelog = "") {
    const prompt = prompts.get(id);
    if (!prompt) return null;
    const version = prompt.versions.length + 1;
    prompt.versions.push({ version, template, createdAt: Date.now(), changelog });
    prompt.template = template;
    prompt.variables = extractVariables(template);
    prompt.updatedAt = Date.now();
    return prompt;
  }

  function renderPrompt(id, variables = {}) {
    const prompt = prompts.get(id);
    if (!prompt) return null;
    let rendered = prompt.template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }
    return rendered;
  }

  function listPrompts(filter = {}) {
    let results = Array.from(prompts.values());
    if (filter.tag) results = results.filter((p) => p.tags.includes(filter.tag));
    if (filter.search) results = results.filter((p) => p.name.includes(filter.search));
    return results;
  }

  function getPrompt(id) { return prompts.get(id) ?? null; }
  function deletePrompt(id) { return prompts.delete(id); }

  // A/B 测试
  function createExperiment(name, promptId, variants) {
    const id = randomUUID().slice(0, 8);
    const exp = {
      id, name, promptId,
      variants: variants.map((v, i) => ({ id: `v${i}`, name: v.name, weight: v.weight ?? 1 / variants.length, template: v.template })),
      traffic: 1.0,
      results: {},
      createdAt: Date.now(),
    };
    experiments.set(id, exp);
    return exp;
  }

  function getExperimentVariant(experimentId) {
    const exp = experiments.get(experimentId);
    if (!exp) return null;
    const rand = Math.random();
    let cumulative = 0;
    for (const variant of exp.variants) {
      cumulative += variant.weight;
      if (rand <= cumulative) return variant;
    }
    return exp.variants[exp.variants.length - 1];
  }

  function recordExperimentResult(experimentId, variantId, result) {
    const exp = experiments.get(experimentId);
    if (!exp) return;
    if (!exp.results[variantId]) exp.results[variantId] = { count: 0, successes: 0, totalLatency: 0 };
    const v = exp.results[variantId];
    v.count++;
    if (result.success) v.successes++;
    v.totalLatency += result.latencyMs ?? 0;
  }

  function extractVariables(template) {
    const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }

  function getStats() {
    return {
      totalPrompts: prompts.size,
      totalVersions: Array.from(prompts.values()).reduce((s, p) => s + p.versions.length, 0),
      totalExperiments: experiments.size,
    };
  }

  return {
    createPrompt, updatePrompt, renderPrompt, listPrompts, getPrompt, deletePrompt,
    createExperiment, getExperimentVariant, recordExperimentResult, getStats,
  };
}
