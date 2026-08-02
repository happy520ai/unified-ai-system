import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function addError(code, path, details = "") {
  errors.push({ code, path, details });
}

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
  windowsHide: true,
})
  .split("\0")
  .filter(Boolean);

const trackedSet = new Set(tracked);
const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "package.json",
  "server.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "apps/ai-gateway-service/src/index.js",
  "apps/agent-console/src/cli-core.js",
  "apps/agent-console/evidence/README.md",
  "apps/ai-gateway-service/evidence/README.md",
  "packages/mcp-server/package.json",
  "packages/mcp-server/src/index.js",
  "packages/mcp-server/src/server.test.js",
  ".codex/config.toml",
  ".github/workflows/indexnow.yml",
  "docs/assets/social-preview.png",
  "docs/codex-mcp-docker-quickstart.html",
  "docs/codex-mcp-docker-quickstart.zh-CN.html",
  "docs/getting-started.md",
  "docs/index.html",
  "docs/index.zh-CN.html",
  "docs/indexnow.json",
  "docs/d6ce2ffbc1353aa5c0284e1efc2d6d5b66e3d048c764c07f.txt",
  "docs/robots.txt",
  "docs/sitemap.xml",
  "docs/terminal-first-ai-gateway.html",
  "skills/unified-ai-gateway/SKILL.md",
  "tools/mcp-smoke.mjs",
  "tools/submit-indexnow.mjs",
  "tools/verify-public-clone.mjs",
];

for (const path of requiredFiles) {
  if (!trackedSet.has(path) || !existsSync(resolve(repoRoot, path))) {
    addError("required_file_missing", path);
  }
}

const forbiddenTrackedPatterns = [
  [/^legacy\//i, "legacy_tree_tracked"],
  [/^docs\/phase/i, "phase_document_tracked"],
  [/^tools\/phase/i, "phase_tool_tracked"],
  [/^capabilities\//i, "generated_capability_artifact_tracked"],
  [/^local-self-use\//i, "historical_self_use_ledger_tracked"],
  [/^model-routing\//i, "historical_model_routing_artifact_tracked"],
  [/^provider-expansion\//i, "historical_provider_expansion_artifact_tracked"],
  [/^apps\/static-showcase\//i, "retired_showcase_tracked"],
  [/^apps\/ai-gateway-service\/src\/ui\//i, "retired_browser_ui_tracked"],
  [/^apps\/ai-gateway-service\/build\.mjs$/i, "retired_browser_builder_tracked"],
  [/^apps\/ai-gateway-service\/src\/tests\/neon-ui(?:-performance)?\.test\.js$/i, "retired_browser_test_tracked"],
  [/^apps\/[^/]+\/evidence\/(?!README\.md$)/i, "generated_evidence_tracked"],
  [/(^|\/)\.env(?:\.|$)/i, "environment_file_tracked"],
  [/\.input\.json$/i, "private_input_tracked"],
];

for (const path of tracked) {
  if (path === ".env.example" || path === ".env.enterprise.example") continue;
  for (const [pattern, code] of forbiddenTrackedPatterns) {
    if (pattern.test(path)) addError(code, path);
  }
}

const rootPackage = readJson("package.json");
const servicePackage = readJson("apps/ai-gateway-service/package.json");
const registryMetadata = readJson("server.json");
const requiredScripts = [
  "start",
  "check",
  "test",
  "mcp",
  "notify:indexnow",
  "verify:mcp",
  "smoke:mcp",
  "check:public",
  "verify:public-clone",
];

for (const script of requiredScripts) {
  if (typeof rootPackage.scripts?.[script] !== "string") {
    addError("required_script_missing", `package.json#scripts.${script}`);
  }
}

const rootScriptCount = Object.keys(rootPackage.scripts ?? {}).length;
const serviceScriptCount = Object.keys(servicePackage.scripts ?? {}).length;
if (rootScriptCount > 20) addError("root_script_surface_too_large", "package.json", String(rootScriptCount));
if (serviceScriptCount > 20) {
  addError("service_script_surface_too_large", "apps/ai-gateway-service/package.json", String(serviceScriptCount));
}

const expectedRegistryName = "io.github.happy520ai/unified-ai-system";
const expectedRegistryImage =
  `ghcr.io/happy520ai/unified-ai-system/mcp-server:${rootPackage.version}`;
if (registryMetadata.name !== expectedRegistryName) {
  addError("mcp_registry_name_invalid", "server.json#name");
}
if (registryMetadata.version !== rootPackage.version) {
  addError(
    "mcp_registry_version_mismatch",
    "server.json#version",
    `${registryMetadata.version} != ${rootPackage.version}`,
  );
}
if (registryMetadata.packages?.[0]?.registryType !== "oci") {
  addError("mcp_registry_package_type_invalid", "server.json#packages[0]");
}
if (registryMetadata.packages?.[0]?.identifier !== expectedRegistryImage) {
  addError(
    "mcp_registry_image_mismatch",
    "server.json#packages[0].identifier",
    registryMetadata.packages?.[0]?.identifier ?? "",
  );
}
if (registryMetadata.packages?.[0]?.transport?.type !== "stdio") {
  addError(
    "mcp_registry_transport_invalid",
    "server.json#packages[0].transport.type",
  );
}

const dockerfile = readFileSync(resolve(repoRoot, "Dockerfile"), "utf8");
if (
  !dockerfile.includes(
    `io.modelcontextprotocol.server.name="${expectedRegistryName}"`,
  )
) {
  addError("mcp_registry_oci_label_missing", "Dockerfile");
}
if (!dockerfile.includes("FROM runtime AS mcp")) {
  addError("mcp_container_target_missing", "Dockerfile");
}

const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
if (readme.includes("BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE")) {
  addError("generated_ledger_in_public_readme", "README.md");
}

const projectSite = readFileSync(resolve(repoRoot, "docs/index.html"), "utf8");
const requiredSocialMetadata = [
  ['property="og:image"', "open_graph_image_missing"],
  ['property="og:image:secure_url"', "open_graph_secure_image_missing"],
  [
    'property="og:image:type" content="image/png"',
    "open_graph_image_type_missing",
  ],
  ['name="twitter:card" content="summary_large_image"', "twitter_large_card_missing"],
  ['name="twitter:title"', "twitter_title_missing"],
  ['name="twitter:description"', "twitter_description_missing"],
  ['name="twitter:image"', "twitter_image_missing"],
];

for (const [marker, code] of requiredSocialMetadata) {
  if (!projectSite.includes(marker)) addError(code, "docs/index.html");
}

const socialPreviewUrl =
  "https://happy520ai.github.io/unified-ai-system/assets/social-preview.png";
if (!projectSite.includes(socialPreviewUrl)) {
  addError("social_preview_url_missing", "docs/index.html");
}

const chineseProjectSitePath = "docs/index.zh-CN.html";
const chineseProjectSite = readFileSync(resolve(repoRoot, chineseProjectSitePath), "utf8");
const chineseProjectSiteUrl =
  "https://happy520ai.github.io/unified-ai-system/index.zh-CN.html";
const requiredChineseSiteMarkers = [
  [chineseProjectSiteUrl, "chinese_home_canonical_missing"],
  ['lang="zh-CN"', "chinese_home_language_missing"],
  ['property="og:locale" content="zh_CN"', "chinese_home_locale_missing"],
  ['"inLanguage": "zh-CN"', "chinese_home_structured_language_missing"],
  ["docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:", "chinese_home_demo_missing"],
  ["生产就绪、L5 自主和 AGI", "chinese_home_evidence_boundary_missing"],
];

for (const [marker, code] of requiredChineseSiteMarkers) {
  if (!chineseProjectSite.includes(marker)) addError(code, chineseProjectSitePath);
}

if (!projectSite.includes('href="index.zh-CN.html"')) {
  addError("chinese_home_english_link_missing", "docs/index.html");
}

const terminalFirstArticlePath = "docs/terminal-first-ai-gateway.html";
const terminalFirstArticle = readFileSync(resolve(repoRoot, terminalFirstArticlePath), "utf8");
const terminalFirstArticleUrl =
  "https://happy520ai.github.io/unified-ai-system/terminal-first-ai-gateway.html";
const requiredArticleMarkers = [
  [terminalFirstArticleUrl, "terminal_first_canonical_missing"],
  ['property="og:type" content="article"', "terminal_first_open_graph_type_missing"],
  ['"@type": "TechArticle"', "terminal_first_structured_data_missing"],
  ["docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:", "terminal_first_demo_missing"],
  ["Production readiness, L5 autonomy, and AGI", "terminal_first_evidence_boundary_missing"],
];

for (const [marker, code] of requiredArticleMarkers) {
  if (!terminalFirstArticle.includes(marker)) addError(code, terminalFirstArticlePath);
}

if (!projectSite.includes('href="terminal-first-ai-gateway.html"')) {
  addError("terminal_first_home_link_missing", "docs/index.html");
}

const sitemap = readFileSync(resolve(repoRoot, "docs/sitemap.xml"), "utf8");
if (!sitemap.includes(chineseProjectSiteUrl)) {
  addError("chinese_home_sitemap_entry_missing", "docs/sitemap.xml");
}

const indexNowConfigPath = "docs/indexnow.json";
const indexNowConfig = readJson(indexNowConfigPath);
const expectedIndexNowEndpoint = "https://api.indexnow.org/indexnow";
const expectedIndexNowHost = "happy520ai.github.io";
const expectedIndexNowPrefix =
  "https://happy520ai.github.io/unified-ai-system/";
if (indexNowConfig.endpoint !== expectedIndexNowEndpoint) {
  addError("indexnow_endpoint_invalid", `${indexNowConfigPath}#endpoint`);
}
if (indexNowConfig.host !== expectedIndexNowHost) {
  addError("indexnow_host_invalid", `${indexNowConfigPath}#host`);
}
if (!/^[A-Za-z0-9-]{8,128}\.txt$/.test(indexNowConfig.keyFile ?? "")) {
  addError("indexnow_key_file_invalid", `${indexNowConfigPath}#keyFile`);
}
const indexNowKeyPath = `docs/${indexNowConfig.keyFile ?? ""}`;
if (!trackedSet.has(indexNowKeyPath) || !existsSync(resolve(repoRoot, indexNowKeyPath))) {
  addError("indexnow_key_file_missing", indexNowKeyPath);
} else {
  const key = readFileSync(resolve(repoRoot, indexNowKeyPath), "utf8").trim();
  if (`${key}.txt` !== indexNowConfig.keyFile) {
    addError("indexnow_key_file_mismatch", indexNowKeyPath);
  }
}
if (!Array.isArray(indexNowConfig.urlList) || indexNowConfig.urlList.length === 0) {
  addError("indexnow_url_list_missing", `${indexNowConfigPath}#urlList`);
} else {
  for (const url of indexNowConfig.urlList) {
    if (typeof url !== "string" || !url.startsWith(expectedIndexNowPrefix)) {
      addError("indexnow_url_outside_site", `${indexNowConfigPath}#urlList`, String(url));
      continue;
    }
    if (!sitemap.includes(`<loc>${url}</loc>`)) {
      addError("indexnow_url_missing_from_sitemap", "docs/sitemap.xml", url);
    }
  }
}

const indexNowWorkflowPath = ".github/workflows/indexnow.yml";
const indexNowWorkflow = readFileSync(resolve(repoRoot, indexNowWorkflowPath), "utf8");
const requiredIndexNowWorkflowMarkers = [
  ["page_build:", "indexnow_pages_trigger_missing"],
  ["github.event.build.status == 'built'", "indexnow_success_gate_missing"],
  ["TRIGGER_SHA: ${{ github.event.build.commit }}", "indexnow_pages_commit_missing"],
  ['git merge-base --is-ancestor "$TRIGGER_SHA" HEAD', "indexnow_ancestor_gate_missing"],
  ['git diff --quiet "${TRIGGER_SHA}^" "$TRIGGER_SHA" -- docs', "indexnow_docs_change_gate_missing"],
  ["node tools/submit-indexnow.mjs --submit", "indexnow_submit_command_missing"],
];

for (const [marker, code] of requiredIndexNowWorkflowMarkers) {
  if (!indexNowWorkflow.includes(marker)) addError(code, indexNowWorkflowPath);
}
if (indexNowWorkflow.includes("workflow_run:")) {
  addError("indexnow_privileged_workflow_chain", indexNowWorkflowPath);
}
if (!sitemap.includes(terminalFirstArticleUrl)) {
  addError("terminal_first_sitemap_entry_missing", "docs/sitemap.xml");
}

const codexDockerGuidePath = "docs/codex-mcp-docker-quickstart.html";
const codexDockerGuide = readFileSync(resolve(repoRoot, codexDockerGuidePath), "utf8");
const codexDockerGuideUrl =
  "https://happy520ai.github.io/unified-ai-system/codex-mcp-docker-quickstart.html";
const chineseCodexDockerGuidePath = "docs/codex-mcp-docker-quickstart.zh-CN.html";
const chineseCodexDockerGuideUrl =
  "https://happy520ai.github.io/unified-ai-system/codex-mcp-docker-quickstart.zh-CN.html";
const requiredCodexGuideMarkers = [
  [codexDockerGuideUrl, "codex_docker_canonical_missing"],
  ['property="og:type" content="article"', "codex_docker_open_graph_type_missing"],
  ['"@type": "HowTo"', "codex_docker_structured_data_missing"],
  ["codex mcp add unified-ai-system -- docker run --rm -i", "codex_docker_add_command_missing"],
  ["codex mcp remove unified-ai-system", "codex_docker_remove_command_missing"],
  ["Not claimed", "codex_docker_evidence_boundary_missing"],
];

for (const [marker, code] of requiredCodexGuideMarkers) {
  if (!codexDockerGuide.includes(marker)) addError(code, codexDockerGuidePath);
}

if (!projectSite.includes('href="codex-mcp-docker-quickstart.html"')) {
  addError("codex_docker_home_link_missing", "docs/index.html");
}

if (!sitemap.includes(codexDockerGuideUrl)) {
  addError("codex_docker_sitemap_entry_missing", "docs/sitemap.xml");
}

const chineseCodexDockerGuide = readFileSync(
  resolve(repoRoot, chineseCodexDockerGuidePath),
  "utf8",
);
const requiredChineseCodexGuideMarkers = [
  [chineseCodexDockerGuideUrl, "chinese_codex_docker_canonical_missing"],
  ['lang="zh-CN"', "chinese_codex_docker_language_missing"],
  ['property="og:locale" content="zh_CN"', "chinese_codex_docker_locale_missing"],
  ['"@type": "HowTo"', "chinese_codex_docker_structured_data_missing"],
  ['"inLanguage": "zh-CN"', "chinese_codex_docker_structured_language_missing"],
  ["codex mcp add unified-ai-system -- docker run --rm -i", "chinese_codex_docker_add_command_missing"],
  ["codex mcp remove unified-ai-system", "chinese_codex_docker_remove_command_missing"],
  ["生产就绪、L5 自主或 AGI", "chinese_codex_docker_evidence_boundary_missing"],
];

for (const [marker, code] of requiredChineseCodexGuideMarkers) {
  if (!chineseCodexDockerGuide.includes(marker)) {
    addError(code, chineseCodexDockerGuidePath);
  }
}

if (!chineseProjectSite.includes('href="codex-mcp-docker-quickstart.zh-CN.html"')) {
  addError("chinese_codex_docker_home_link_missing", chineseProjectSitePath);
}

if (!codexDockerGuide.includes('hreflang="zh-CN"')) {
  addError("codex_docker_chinese_alternate_missing", codexDockerGuidePath);
}

if (!chineseCodexDockerGuide.includes('hreflang="en"')) {
  addError("chinese_codex_docker_english_alternate_missing", chineseCodexDockerGuidePath);
}

if (!sitemap.includes(chineseCodexDockerGuideUrl)) {
  addError("chinese_codex_docker_sitemap_entry_missing", "docs/sitemap.xml");
}

const agentSkillPath = "skills/unified-ai-gateway/SKILL.md";
const agentSkill = readFileSync(resolve(repoRoot, agentSkillPath), "utf8");
const skillsShUrl =
  "https://skills.sh/happy520ai/unified-ai-system/unified-ai-gateway";
const skillsInstallCommand =
  "npx skills add happy520ai/unified-ai-system --skill unified-ai-gateway --agent codex --copy --yes";
const chineseReadme = readFileSync(resolve(repoRoot, "README.zh-CN.md"), "utf8");
const requiredAgentSkillMarkers = [
  ["name: unified-ai-gateway", "agent_skill_name_missing"],
  ["source_repo: happy520ai/unified-ai-system", "agent_skill_source_missing"],
  ["production readiness, L5 autonomy, or AGI", "agent_skill_evidence_boundary_missing"],
  [
    "https://github.com/happy520ai/unified-ai-system/blob/master/docs/security/mcp-image-review-0.3.2.md",
    "agent_skill_image_review_link_missing",
  ],
];

for (const [marker, code] of requiredAgentSkillMarkers) {
  if (!agentSkill.includes(marker)) addError(code, agentSkillPath);
}

if (/\]\(\.\.?\//.test(agentSkill)) {
  addError("agent_skill_relative_link_not_portable", agentSkillPath);
}

for (const [content, path, code] of [
  [readme, "README.md", "agent_skill_install_missing_from_readme"],
  [chineseReadme, "README.zh-CN.md", "agent_skill_install_missing_from_chinese_readme"],
]) {
  if (!content.includes(skillsInstallCommand)) addError(code, path);
  if (!content.includes(skillsShUrl)) addError(`${code}_listing`, path);
}

if (!projectSite.includes(skillsShUrl)) {
  addError("agent_skill_listing_missing_from_site", "docs/index.html");
}

if (!chineseProjectSite.includes(skillsShUrl)) {
  addError("agent_skill_listing_missing_from_chinese_site", chineseProjectSitePath);
}

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const secretPatterns = [
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{80,}\r?\n-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    code: "private_key",
  },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, code: "openai_style_key" },
  { pattern: /\bghp_[A-Za-z0-9]{30,}\b/g, code: "github_token" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, code: "github_pat" },
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    code: "aws_access_key",
    allowedMatches: new Set(["AKIAIOSFODNN7EXAMPLE"]),
  },
];
const machinePathPatterns = [
  { pattern: /[A-Za-z]:\\Users\\([^\\\s"'`]+)/g, code: "windows_user_path" },
  { pattern: /(?:^|[\s"'`=(])\/Users\/([^/\s"'`]+)/gm, code: "mac_user_path" },
  { pattern: /(?:^|[\s"'`=(])\/home\/([^/\s"'`]+)/gm, code: "linux_user_path" },
];
const genericUserNames = new Set([
  "example",
  "name",
  "parent",
  "root",
  "temp",
  "test",
  "tester",
  "tmp",
  "user",
  "username",
  "users",
  "xxx",
]);

function normalizeMachineUser(value) {
  return value.replace(/[),.;:\]}）】。，“”]+$/gu, "").toLowerCase();
}

let scannedTextFiles = 0;
for (const path of tracked) {
  const absolutePath = resolve(repoRoot, path);
  if (!existsSync(absolutePath) || statSync(absolutePath).size > 1_000_000) continue;
  if (!textExtensions.has(extname(path).toLowerCase()) && !path.startsWith(".env.")) continue;
  const text = readFileSync(absolutePath, "utf8");
  if (text.includes("\0")) continue;
  scannedTextFiles += 1;
  for (const { pattern, code, allowedMatches = new Set() } of secretPatterns) {
    const unexpectedMatch = [...text.matchAll(pattern)].find(
      (match) => !allowedMatches.has(match[0]),
    );
    if (unexpectedMatch) addError(code, path);
  }
  for (const { pattern, code } of machinePathPatterns) {
    const unexpectedMatch = [...text.matchAll(pattern)].find(
      (match) => !genericUserNames.has(normalizeMachineUser(match[1])),
    );
    if (unexpectedMatch) addError(code, path);
  }
}

const result = {
  ok: errors.length === 0,
  trackedFiles: tracked.length,
  scannedTextFiles,
  rootScriptCount,
  serviceScriptCount,
  errors,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
