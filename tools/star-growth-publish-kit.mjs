#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outputArgIndex = args.indexOf("--output");
const output = outputArgIndex >= 0 ? args[outputArgIndex + 1] : null;
const outputFile = output || "docs/star-growth-publish-output.md";

const date = new Date().toISOString().slice(0, 10);
const repoUrl = "https://github.com/happy520ai/unified-ai-system";
const demoCommand =
  "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.2 pnpm gateway demo";
const issueTemplate =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";

const posts = {
  githubEn: `I verified Unified AI System in 60 seconds:\n\n${demoCommand}\n\nNo API key is needed for baseline check.\nRepo: ${repoUrl}`,
  xEn: `Unified AI System 60s baseline:\n${demoCommand}\n\n- Local fake-provider\n- Deterministic output\n- MCP + CLI + Codex / Cursor / Cline\n- Repo: ${repoUrl}`,
  githubPlain: `I verified Unified AI System in 60 seconds:\n\n${demoCommand}\n\nDefault path uses local fake-provider.\nNo API key required.\nRepo: ${repoUrl}`,
  twitterLike: `Built a terminal-first AI gateway with deterministic local verification:\n- fake-provider baseline\n- explicit provider boundaries\n- CLI + MCP + Codex / Cursor / Cline\n\nRepo: ${repoUrl}\n${demoCommand}`,
  redditEn: `Open-source AI infrastructure update:\n- local fake-provider verification in 60 seconds\n- prompt enhancement turns rough language into structured intent\n- explicit approval & provider policy\n\nRepo: ${repoUrl}\n${demoCommand}`,
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

writeFileSync(outputFile, `${fileContent}\n`, "utf8");
console.log(`Saved to ${outputFile}`);
