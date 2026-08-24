import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputJson = process.argv.includes("--json");
const requiredOverrides = Object.freeze({
  "brace-expansion@2": "2.1.4",
  "brace-expansion@5": "5.0.9",
  "postcss@8": "8.5.26",
  "vite@8": "8.0.16",
});

function readText(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function extractTopLevelMapping(source, key) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === `${key}:` && !/^\s/.test(line));
  if (start < 0) return {};

  const values = {};
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    const match = line.match(/^\s{2}([^:#][^:]*):\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/);
    if (match) values[match[1].trim()] = match[2].trim();
  }
  return values;
}

function collectWorkflowPnpmVersions(expectedVersion) {
  const workflowRoot = join(repoRoot, ".github", "workflows");
  const entries = [];
  for (const file of readdirSync(workflowRoot).filter((name) => /\.ya?ml$/i.test(name)).sort()) {
    const source = readFileSync(join(workflowRoot, file), "utf8");
    if (!source.includes("pnpm/action-setup") && !source.includes("corepack prepare pnpm@")) continue;

    const versions = [];
    for (const match of source.matchAll(/pnpm\/action-setup[\s\S]{0,320}?\n\s*version:\s*["']?([0-9]+(?:\.[0-9]+){1,2})/g)) {
      versions.push({ installer: "pnpm/action-setup", version: match[1] });
    }
    for (const match of source.matchAll(/corepack prepare pnpm@([0-9]+(?:\.[0-9]+){1,2})\s+--activate/g)) {
      versions.push({ installer: "corepack", version: match[1] });
    }
    entries.push({
      file: `.github/workflows/${file}`,
      versions,
      aligned: versions.length > 0 && versions.every(({ version }) => version === expectedVersion),
    });
  }
  return entries;
}

const packageJson = JSON.parse(readText("package.json"));
const workspaceOverrides = extractTopLevelMapping(readText("pnpm-workspace.yaml"), "overrides");
const lockOverrides = extractTopLevelMapping(readText("pnpm-lock.yaml"), "overrides");
const packageManagerMatch = String(packageJson.packageManager || "").match(/^pnpm@([0-9]+(?:\.[0-9]+){2})$/);
const pnpmVersion = packageManagerMatch?.[1] || null;
const pnpmMajor = pnpmVersion ? Number(pnpmVersion.split(".")[0]) : null;
const expectedEngineRange = pnpmVersion ? `>=${pnpmVersion} <${pnpmMajor + 1}` : null;
const workflowVersions = pnpmVersion ? collectWorkflowPnpmVersions(pnpmVersion) : [];
const issues = [];
const dockerWorkflowSource = readText(".github/workflows/docker-build-push.yml");
const dockerfileSource = readText("Dockerfile");
const composeSource = readText("docker-compose.yml");

if (!pnpmVersion) {
  issues.push({ code: "package_manager_not_exact", expected: "pnpm@<major>.<minor>.<patch>" });
}
if (expectedEngineRange && packageJson.engines?.pnpm !== expectedEngineRange) {
  issues.push({
    code: "package_manager_engine_mismatch",
    expected: expectedEngineRange,
    actual: packageJson.engines?.pnpm || null,
  });
}
if (Object.hasOwn(packageJson, "pnpm")) {
  issues.push({ code: "package_json_pnpm_config_duplicate", authority: "pnpm-workspace.yaml" });
}
for (const [selector, expectedVersion] of Object.entries(requiredOverrides)) {
  const workspaceVersion = workspaceOverrides[selector] || null;
  const lockVersion = lockOverrides[selector] || null;
  if (workspaceVersion !== expectedVersion) {
    issues.push({ code: "workspace_override_missing_or_changed", selector, expectedVersion, actual: workspaceVersion });
  }
  if (lockVersion !== expectedVersion) {
    issues.push({ code: "lockfile_override_missing_or_changed", selector, expectedVersion, actual: lockVersion });
  }
}
for (const workflow of workflowVersions) {
  if (!workflow.aligned) {
    issues.push({
      code: "workflow_pnpm_version_mismatch",
      file: workflow.file,
      expectedVersion: pnpmVersion,
      actualVersions: workflow.versions,
    });
  }
}

const dockerReleaseChecks = {
  qemuActionPinned: /uses:\s*docker\/setup-qemu-action@[a-f0-9]{40}\b/.test(dockerWorkflowSource),
  gatewayTargetExplicit: /target:\s*gateway\b/.test(dockerWorkflowSource),
  mcpTargetExplicit: /target:\s*mcp\b/.test(dockerWorkflowSource),
  multiArchitectureBuilds: (dockerWorkflowSource.match(/platforms:\s*linux\/amd64,linux\/arm64/g) ?? []).length >= 2,
  sbomAttestations: (dockerWorkflowSource.match(/sbom:\s*true/g) ?? []).length >= 2,
  provenanceAttestations: (dockerWorkflowSource.match(/provenance:\s*mode=max/g) ?? []).length >= 2,
  publishedManifestVerification:
    dockerWorkflowSource.includes('grep -q "linux/amd64"')
    && dockerWorkflowSource.includes('grep -q "linux/arm64"'),
  rootWorkspaceGate: /- name:\s*Workspace check[\s\S]{0,120}?run:\s*pnpm check\b/.test(dockerWorkflowSource),
  noBestEffortArmRelease: !/Build and push arm64[\s\S]{0,120}?continue-on-error:\s*true/.test(dockerWorkflowSource),
  runtimeRootNotWritable: !/chown\s+node:node\s+\/app\s*(?:\n|$)/.test(dockerfileSource),
  explicitRuntimeVolumes:
    dockerfileSource.includes('VOLUME ["/app/.data", "/app/apps/ai-gateway-service/.data"]'),
  composeReadOnlyRoot: /\n\s+read_only:\s*true\b/.test(composeSource),
  composeDropsCapabilities: /\n\s+cap_drop:\s*\n\s+- ALL\b/.test(composeSource),
  composeNoNewPrivileges: /\n\s+security_opt:\s*\n\s+- no-new-privileges:true\b/.test(composeSource),
  composeBoundedTmpfs: composeSource.includes("/tmp:rw,noexec,nosuid,size=64m"),
  smokeExercisesReadOnlyRuntime:
    (dockerWorkflowSource.match(/--read-only/g) ?? []).length >= 2
    && dockerWorkflowSource.includes("--tmpfs /tmp:rw,noexec,nosuid,size=64m"),
};
for (const [check, passed] of Object.entries(dockerReleaseChecks)) {
  if (!passed) issues.push({ code: "docker_release_supply_chain_check_failed", check });
}

const result = {
  ok: issues.length === 0,
  packageManager: packageJson.packageManager || null,
  pnpmEngine: packageJson.engines?.pnpm || null,
  overrideAuthority: "pnpm-workspace.yaml",
  requiredOverrides,
  workspaceOverrides,
  lockOverrides,
  workflowVersions,
  dockerReleaseChecks,
  issues,
};

if (outputJson) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (result.ok) {
  process.stdout.write(
    `Supply-chain config passed: ${packageJson.packageManager}, ${Object.keys(requiredOverrides).length} overrides, ${workflowVersions.length} workflows aligned.\n`,
  );
} else {
  process.stderr.write(`Supply-chain config failed:\n${JSON.stringify(result, null, 2)}\n`);
}

if (!result.ok) process.exitCode = 1;
