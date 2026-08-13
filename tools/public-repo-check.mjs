import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ISSUE_SOURCE = "public-repo-check";

function normalizeIssueCode(raw) {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length === 0 ? "unknown_issue" : slug;
}

function normalizeSeverity(raw) {
  const normalized = String(raw ?? "").toLowerCase();
  if (["high", "medium", "low", "info", "unknown"].includes(normalized)) {
    return normalized;
  }
  return "unknown";
}

function summarizeIssueCodes(issueCodes) {
  const summary = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    blocking: false,
  };
  if (!Array.isArray(issueCodes)) return summary;
  for (const issue of issueCodes) {
    const severity = normalizeSeverity(issue?.severity);
    if (severity === "high") summary.high += 1;
    else if (severity === "medium") summary.medium += 1;
    else if (severity === "low") summary.low += 1;
    else if (severity === "info") summary.info += 1;
    else summary.unknown += 1;
    summary.total += 1;
  }
  summary.blocking = summary.high > 0;
  return summary;
}

function inferSeverityFromCode(code) {
  const normalized = String(code ?? "").toLowerCase();
  if (
    normalized.includes("missing")
    || normalized.includes("invalid")
    || normalized.includes("mismatch")
    || normalized.includes("outside")
    || normalized.includes("mutable")
    || normalized.includes("stale")
    || normalized.includes("hardening_missing")
    || normalized.includes("mutation")
    || normalized.includes("error")
    || normalized.includes("violation")
  ) return "high";

  if (
    normalized.includes("tracked")
    || normalized.includes("machine_readable")
    || normalized.includes("marker_missing")
    || normalized.includes("link_missing")
    || normalized.includes("entry_missing")
  ) return "medium";

  return "low";
}

function buildIssueCodesFromErrors(reports) {
  if (!Array.isArray(reports) || reports.length === 0) return [];
  const normalized = [];
  const seen = new Set();
  for (const report of reports) {
    if (!report || typeof report !== "object") continue;
    const code = normalizeIssueCode(report.code);
    const severity = normalizeSeverity(inferSeverityFromCode(code));
    const message = report.details
      ? `${report.code}: ${String(report.path)} ${report.details}`
      : `${report.code}: ${String(report.path)}`;
    const key = `${code}:${severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      code,
      severity,
      message,
      artifactPath: report.path,
      source: ISSUE_SOURCE,
    });
  }
  return normalized;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));
}

function addError(code, path, details = "") {
  errors.push({ code, path, details });
}

function listGitFiles(args) {
  return execFileSync("git", ["ls-files", "-z", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  })
    .split("\0")
    .filter(Boolean);
}

const tracked = listGitFiles([]);
const publicCandidates = listGitFiles([
  "--cached",
  "--others",
  "--exclude-standard",
]);

const trackedSet = new Set(tracked);
const untrackedPublicCandidates = publicCandidates.filter(
  (path) => !trackedSet.has(path),
);
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
  "apps/ai-gateway-service/src/http/a2aGateway.js",
  "apps/ai-gateway-service/src/http/a2aGateway.test.js",
  "apps/ai-gateway-service/src/http/a2aRoutes.js",
  "apps/ai-gateway-service/src/http/openAiResponsesRoutes.js",
  "apps/ai-gateway-service/src/http/openAiResponsesRoutes.test.js",
  "apps/agent-console/src/cli-core.js",
  "apps/agent-console/evidence/README.md",
  "apps/ai-gateway-service/evidence/README.md",
  "packages/mcp-server/package.json",
  "packages/mcp-server/src/http-entry.js",
  "packages/mcp-server/src/http.js",
  "packages/mcp-server/src/http.test.js",
  "packages/mcp-server/src/index.js",
  "packages/mcp-server/src/server.test.js",
  ".codex-plugin/plugin.json",
  ".codex/config.toml",
  ".mcp.json",
  ".github/workflows/indexnow.yml",
  "docs/assets/social-preview.png",
  "docs/codex-mcp-docker-quickstart.html",
  "docs/codex-mcp-docker-quickstart.zh-CN.html",
  "docs/getting-started.md",
  "docs/index.html",
  "docs/index.zh-CN.html",
  "docs/indexnow.json",
  "docs/prompt-enhancement.html",
  "docs/prompt-enhancement.zh-CN.html",
  "docs/examples/prompt-enhancement.go",
  "docs/examples/prompt-enhancement.cs",
  "docs/examples/prompt-enhancement.csproj",
  "docs/examples/shared-sdk-prompt-enhancement.mjs",
  "docs/examples/openai-sdk-chat.mjs",
  "docs/examples/a2a-sdk-client.mjs",
  "docs/examples/shared-sdk-cancellation.mjs",
  "docs/examples/prompt-enhancement-contract.mjs",
  "docs/security/mcp-image-review-0.4.9.md",
  "docs/d6ce2ffbc1353aa5c0284e1efc2d6d5b66e3d048c764c07f.txt",
  "docs/robots.txt",
  "docs/sitemap.xml",
  "docs/terminal-first-ai-gateway.html",
  "docs/a2a-protocol.md",
  "docs/a2a-protocol.zh-CN.md",
  "docs/protocol-client-compatibility.md",
  "docs/protocol-client-compatibility.zh-CN.md",
  ".github/ISSUE_TEMPLATE/protocol-client-report.yml",
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

for (const path of publicCandidates) {
  if (path === ".env.example" || path === ".env.enterprise.example") continue;
  for (const [pattern, code] of forbiddenTrackedPatterns) {
    if (pattern.test(path)) addError(code, path);
  }
}

const rootPackage = readJson("package.json");
const servicePackage = readJson("apps/ai-gateway-service/package.json");
const registryMetadata = readJson("server.json");
const pluginManifest = readJson(".codex-plugin/plugin.json");
const pluginMcpConfig = readJson(".mcp.json");
const requiredScripts = [
  "start",
  "check",
  "test",
  "mcp",
  "mcp:http",
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
if (rootScriptCount > 21) addError("root_script_surface_too_large", "package.json", String(rootScriptCount));
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

if (pluginManifest.version !== rootPackage.version) {
  addError(
    "codex_plugin_version_mismatch",
    ".codex-plugin/plugin.json#version",
    `${pluginManifest.version} != ${rootPackage.version}`,
  );
}

for (const [value, code] of [
  [pluginManifest.description, "codex_plugin_nine_tools_missing"],
  [pluginManifest.interface?.shortDescription, "codex_plugin_short_description_stale"],
]) {
  if (!/governed MCP tools/i.test(value ?? "")) {
    addError(code, ".codex-plugin/plugin.json");
  }
}

if (!/prompt enhancement/i.test(pluginManifest.description ?? "")) {
  addError("codex_plugin_prompt_enhancement_missing", ".codex-plugin/plugin.json");
}

const pluginMcpArgs = pluginMcpConfig.mcpServers?.["unified-ai-system"]?.args ?? [];
const expectedPluginImage =
  "ghcr.io/happy520ai/unified-ai-system/mcp-server@sha256:751a0d32acd2d6b1da6ad9ac67987fbd1ff36ce26b7160014d8605f18b7907b3";
for (const [marker, code] of [
  ["--network", "codex_plugin_network_hardening_missing"],
  ["none", "codex_plugin_network_none_missing"],
  ["--cap-drop", "codex_plugin_capability_hardening_missing"],
  ["ALL", "codex_plugin_capability_drop_all_missing"],
  ["--security-opt", "codex_plugin_privilege_hardening_missing"],
  ["no-new-privileges", "codex_plugin_no_new_privileges_missing"],
  [expectedPluginImage, "codex_plugin_reviewed_image_missing"],
]) {
  if (!pluginMcpArgs.includes(marker)) addError(code, ".mcp.json");
}

if (pluginMcpArgs.some((value) => /\/mcp-server:[^/]+$/.test(value))) {
  addError("codex_plugin_mutable_image_reference", ".mcp.json");
}

const mcpSmoke = readFileSync(resolve(repoRoot, "tools/mcp-smoke.mjs"), "utf8");
for (const [marker, code] of [
  ['"--pull",\n        "never"', "mcp_smoke_pull_never_missing"],
  ['"--network",\n        "none"', "mcp_smoke_network_none_missing"],
  ['"--cap-drop",\n        "ALL"', "mcp_smoke_capability_drop_missing"],
  [
    '"--security-opt",\n        "no-new-privileges"',
    "mcp_smoke_no_new_privileges_missing",
  ],
]) {
  if (!mcpSmoke.includes(marker)) addError(code, "tools/mcp-smoke.mjs");
}

const currentImageReviewPath = "docs/security/mcp-image-review-0.4.9.md";
const currentImageReview = readFileSync(
  resolve(repoRoot, currentImageReviewPath),
  "utf8",
);
for (const [marker, code] of [
  [expectedPluginImage.split("@")[1], "mcp_image_review_index_digest_missing"],
  [
    "sha256:ff6cf988b01d5fb2e97aabe8e952f6a303dcffe650df5b4dcb0ba3d51ee88c06",
    "mcp_image_review_amd64_manifest_missing",
  ],
  [
    "sha256:90318b9e373820f863c1c1addc759be4b5ce186f2ecb6232ee502fad7c6613de",
    "mcp_image_review_arm64_manifest_missing",
  ],
  [
    "sha256:0c2c0c7b9c7fb7ca24c73d9a903bcf719b079a0b285a3a3269ee3ae059905e97",
    "mcp_image_review_amd64_config_missing",
  ],
  [
    "sha256:c2047eb63fdc42bcb16d53fca17d78a4a6fb355cf6320b9aa6688e594371054f",
    "mcp_image_review_arm64_config_missing",
  ],
  [
    "0d4635a83683f488d7d6ab2657cd90af01f143641c76df9f3eb4f43ee7109aab",
    "mcp_image_review_amd64_inventory_missing",
  ],
  [
    "f90f4cb9754e640538e912c6470e55828b962e67952e94129682e25cb3a95e4c",
    "mcp_image_review_arm64_inventory_missing",
  ],
  [
    "342a47313927870bcc696be13c9e5fb922062dac",
    "mcp_image_review_revision_missing",
  ],
  [
    "Credential-like file artifacts under `/app` | `0` | `0`",
    "mcp_image_review_credential_result_missing",
  ],
]) {
  if (!currentImageReview.includes(marker)) {
    addError(code, currentImageReviewPath);
  }
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

const currentVersionMarker = String(rootPackage.version);
const versionedPublicEntryPoints = [
  "README.md",
  "README.zh-CN.md",
  "docs/index.html",
  "docs/index.zh-CN.html",
  "docs/codex-mcp-docker-quickstart.html",
  "docs/codex-mcp-docker-quickstart.zh-CN.html",
  "docs/getting-started.md",
  "docs/llms.txt",
  ".github/ISSUE_TEMPLATE/usage-verification-report.yml",
  "docs/prompt-enhancement.html",
  "docs/prompt-enhancement.zh-CN.html",
];

for (const path of versionedPublicEntryPoints) {
  const content = readFileSync(resolve(repoRoot, path), "utf8");
  if (!content.includes(currentVersionMarker)) {
    addError(
      "public_entry_point_version_stale",
      path,
      `Expected current package version ${currentVersionMarker}`,
    );
  }
}

for (const path of ["docs/index.html", "docs/index.zh-CN.html"]) {
  const content = readFileSync(resolve(repoRoot, path), "utf8");
  if (!/pnpm (?:--silent )?gateway demo \"/.test(content)) {
    addError("public_home_demo_input_missing", path);
  }
  if (!content.includes("--enhance --profile coding --json")) {
    addError("public_home_demo_flags_missing", path);
  }
  if (!content.includes("pnpm --silent gateway demo")) {
    addError("public_home_demo_machine_readable_missing", path);
  }
}

const projectSite = readFileSync(resolve(repoRoot, "docs/index.html"), "utf8");
const browserPromptEnhancerPath = "docs/prompt-enhancer.js";
const browserPromptEnhancer = readFileSync(
  resolve(repoRoot, browserPromptEnhancerPath),
  "utf8",
);
const runtimePromptEnhancer = readFileSync(
  resolve(
    repoRoot,
    "apps/ai-gateway-service/src/prompts/naturalLanguagePromptEnhancer.js",
  ),
  "utf8",
);
const goPromptEnhancerPath = "docs/examples/prompt-enhancement.go";
const goPromptEnhancer = readFileSync(resolve(repoRoot, goPromptEnhancerPath), "utf8");
for (const marker of [
  "package main",
  "net/http",
  "/health/check",
  "/prompts/enhance",
  "providerCalled",
  "credentialRequired",
  "deterministic",
]) {
  if (!goPromptEnhancer.includes(marker)) {
    addError("go_prompt_enhancer_marker_missing", goPromptEnhancerPath, marker);
  }
}
if (/\"(?:github\.com|golang\.org|gopkg\.in)\//.test(goPromptEnhancer)) {
  addError(
    "go_prompt_enhancer_external_dependency",
    goPromptEnhancerPath,
    "The public example must use only Go's standard library.",
  );
}
const dotnetPromptEnhancerPath = "docs/examples/prompt-enhancement.cs";
const dotnetPromptEnhancer = readFileSync(
  resolve(repoRoot, dotnetPromptEnhancerPath),
  "utf8",
);
for (const marker of [
  "HttpClient",
  "System.Text.Json",
  "/health/check",
  "/prompts/enhance",
  "ProviderCalled",
  "CredentialRequired",
  "Deterministic",
]) {
  if (!dotnetPromptEnhancer.includes(marker)) {
    addError("dotnet_prompt_enhancer_marker_missing", dotnetPromptEnhancerPath, marker);
  }
}
if (dotnetPromptEnhancer.includes("PackageReference")) {
  addError(
    "dotnet_prompt_enhancer_external_dependency",
    dotnetPromptEnhancerPath,
    "The public example must use only the .NET standard library.",
  );
}
const browserPromptEnhancerBanner =
  "// Generated by pnpm sync:prompt-demo. Do not edit directly.\n";

if (browserPromptEnhancer !== `${browserPromptEnhancerBanner}${runtimePromptEnhancer}`) {
  addError(
    "browser_prompt_enhancer_out_of_sync",
    browserPromptEnhancerPath,
    "Run pnpm sync:prompt-demo",
  );
}

for (const marker of ["任务", "代码"]) {
  if (!browserPromptEnhancer.includes(marker)) {
    addError(
      "browser_prompt_enhancer_chinese_content_missing",
      browserPromptEnhancerPath,
      `Expected Chinese marker: ${marker}`,
    );
  }
}

const requiredPromptLabMarkers = [
  ["data-prompt-lab", "prompt_lab_missing"],
  ["data-prompt-form", "prompt_lab_form_missing"],
  ["data-prompt-output", "prompt_lab_output_missing"],
  ["data-prompt-copy", "prompt_lab_copy_missing"],
  ["data-prompt-download-evidence", "prompt_lab_download_evidence_missing"],
];

const promptEnhancementPages = [
  ["docs/prompt-enhancement.html", "natural_language_enhancement_page_missing", [
    "Natural-Language Prompt Enhancement",
    "providerCalled=false",
    "gateway_prompt_enhance",
    "prompt-enhancement-demo.png",
  ]],
  ["docs/prompt-enhancement.zh-CN.html", "chinese_natural_language_enhancement_page_missing", [
    "自然语言提示词增强",
    "providerCalled=false",
    "gateway_prompt_enhance",
    "prompt-enhancement-demo.png",
  ]],
];

for (const [path, code, markers] of promptEnhancementPages) {
  const page = readFileSync(resolve(repoRoot, path), "utf8");
  for (const marker of markers) {
    if (!page.includes(marker)) addError(code, path, marker);
  }
}

for (const [marker, code] of requiredPromptLabMarkers) {
  if (!projectSite.includes(marker)) addError(code, "docs/index.html");
}

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

for (const [marker, code] of requiredPromptLabMarkers) {
  if (!chineseProjectSite.includes(marker)) {
    addError(`chinese_${code}`, chineseProjectSitePath);
  }
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

for (const [path, page, codePrefix] of [
  [codexDockerGuidePath, codexDockerGuide, "codex_docker"],
  [chineseCodexDockerGuidePath, chineseCodexDockerGuide, "chinese_codex_docker"],
]) {
  const articleModifiedTime = page.match(
    /<meta property="article:modified_time" content="([^"]+)"/,
  )?.[1];
  const structuredModifiedDate = page.match(
    /"dateModified":\s*"(\d{4}-\d{2}-\d{2})"/,
  )?.[1];
  if (!articleModifiedTime) {
    addError(`${codePrefix}_modified_time_missing`, path);
  }
  if (!structuredModifiedDate) {
    addError(`${codePrefix}_structured_modified_date_missing`, path);
  }
  if (
    articleModifiedTime &&
    structuredModifiedDate &&
    articleModifiedTime.slice(0, 10) !== structuredModifiedDate
  ) {
    addError(
      `${codePrefix}_modified_time_mismatch`,
      path,
      `${articleModifiedTime} != ${structuredModifiedDate}`,
    );
  }
}

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
const codespacesUrl =
  "https://codespaces.new/happy520ai/unified-ai-system?quickstart=1";
for (const [content, path, code] of [
  [readme, "README.md", "codespaces_link_missing_from_readme"],
  [chineseReadme, "README.zh-CN.md", "codespaces_link_missing_from_chinese_readme"],
]) {
  if (!content.includes(codespacesUrl)) addError(code, path);
}
for (const [content, path, marker, code] of [
  [
    readme,
    "README.md",
    'pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence',
    "codespaces_first_run_missing_from_readme",
  ],
  [
    chineseReadme,
    "README.zh-CN.md",
    'pnpm gateway demo "帮我为团队设计一个小型 API" --enhance --profile coding --evidence',
    "codespaces_first_run_missing_from_chinese_readme",
  ],
]) {
  if (!content.includes(marker)) addError(code, path);
}
const requiredChineseReadmeMarkers = [
  ["面向自然语言增强", "chinese_readme_title_missing"],
  ["60 秒体验", "chinese_readme_quickstart_missing"],
  ["不声称 AGI", "chinese_readme_evidence_boundary_missing"],
];
if (chineseReadme.includes("\uFFFD")) {
  addError("chinese_readme_invalid_utf8", "README.zh-CN.md");
}
for (const [marker, code] of requiredChineseReadmeMarkers) {
  if (!chineseReadme.includes(marker)) addError(code, "README.zh-CN.md");
}
const requiredAgentSkillMarkers = [
  ["name: unified-ai-gateway", "agent_skill_name_missing"],
  ["source_repo: happy520ai/unified-ai-system", "agent_skill_source_missing"],
  ["gateway_prompt_enhance", "agent_skill_prompt_enhancement_missing"],
  ["production readiness, L5 autonomy, or AGI", "agent_skill_evidence_boundary_missing"],
  [
    "https://github.com/happy520ai/unified-ai-system/blob/master/docs/security/mcp-image-review-0.4.9.md",
    "agent_skill_image_review_link_missing",
  ],
  [
    "sha256:751a0d32acd2d6b1da6ad9ac67987fbd1ff36ce26b7160014d8605f18b7907b3",
    "agent_skill_reviewed_image_digest_missing",
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
for (const path of publicCandidates) {
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
  candidateFiles: publicCandidates.length,
  untrackedCandidateFiles: untrackedPublicCandidates.length,
  scannedTextFiles,
  rootScriptCount,
  serviceScriptCount,
  errors,
};
const issueCodes = buildIssueCodesFromErrors(errors);
result.issueCodes = issueCodes;
result.issueCodeSummary = summarizeIssueCodes(issueCodes);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
