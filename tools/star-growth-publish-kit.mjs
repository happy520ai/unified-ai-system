#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const outputArgIndex = args.indexOf("--output");
const output = outputArgIndex >= 0 ? args[outputArgIndex + 1] : null;
const outputFile = output || ".tmp/growth/star-growth-publish-output.md";

const date = new Date().toISOString().slice(0, 10);
const repoUrl = "https://github.com/happy520ai/unified-ai-system";
const demoCommand =
  "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.9 pnpm gateway demo \"Build a small API for my team\" --enhance --profile coding";
const pipeCommand =
  "cat request.txt | pnpm gateway enhance --profile auto --json";
const dockerPipeCommand =
  "printf '%s' \"Plan a launch for a small API\" | docker run --rm -i ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.9 pnpm --silent gateway demo --enhance --profile planning --language en --json";
const issueTemplate =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";

const posts = {
  githubEn: `I verified Unified AI System's prompt enhancement in 60 seconds:\n\n${demoCommand}\n\nNo API key is needed for the local enhancement preview.\nRepo: ${repoUrl}`,
  xEn: `Unified AI System 60s prompt enhancement:\n${demoCommand}\n\n- Local fake-provider\n- Deterministic output\n- MCP + CLI + Codex / Cursor / Cline\n- Repo: ${repoUrl}`,
  githubPlain: `I verified Unified AI System in 60 seconds:\n\n${demoCommand}\n\nThe local fake-provider preserves the original request and prints a structured prompt.\nNo API key required.\nRepo: ${repoUrl}`,
  twitterLike: `Built a terminal-first AI gateway with deterministic local verification:\n- natural-language prompt enhancement\n- explicit provider boundaries\n- CLI + MCP + Codex / Cursor / Cline\n\nRepo: ${repoUrl}\n${demoCommand}`,
  redditEn: `Open-source AI infrastructure update:\n- local fake-provider verification in 60 seconds\n- prompt enhancement turns rough language into structured intent\n- explicit approval & provider policy\n\nRepo: ${repoUrl}\n${demoCommand}`,
  shellPipelineEn: `Already have requests in files or shell pipelines?\n\n${pipeCommand}\n\nAfter starting the local gateway, stdin becomes a provider-free prompt-enhancement path.\nRepo: ${repoUrl}`,
  noCloneDockerPipelineEn: `No checkout or API key needed:\n\n${dockerPipeCommand}\n\nThe published image reads stdin, preserves the original request, and prints deterministic fake-provider evidence before exiting.\nRepo: ${repoUrl}`,
  discordEn: `Want to try a verifiable AI gateway?\nTry:\n${demoCommand}\n\nIf it works, share one output line and open:\n${issueTemplate}`,
};

console.log(`# Star Growth Blast Kit (${date})`);
console.log("");
console.log("## Core publish links");
console.log(`- Repo: ${repoUrl}`);
console.log(`- Verification issue template: ${issueTemplate}`);
console.log("");
console.log("## One-click text snippets");

for (const [key, value] of Object.entries(posts)) {
  console.log(`### ${key}`);
  console.log("```text");
  console.log(value);
  console.log("```");
  console.log("");
}

const fileContent = [
  `# Star Growth Blast Kit (${date})`,
  "",
  "## Core publish links",
  `- Repo: ${repoUrl}`,
  `- Verification issue template: ${issueTemplate}`,
  "",
  "## One-click text snippets",
  "",
  ...Object.entries(posts).flatMap(([key, value]) => [
    `### ${key}`,
    "```text",
    value,
    "```",
    "",
  ]),
].join("\n");

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${fileContent}\n`, "utf8");
console.log(`Saved to ${outputFile}`);
