import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";
import { fetchText, writeEvidenceWithRenderer } from "./entrypointUtils.js";

const execFileAsync = promisify(execFile);
const phase = "phase-116a-docker-compose-runtime";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const composeProject = "unified-ai-system-phase116a";
const serviceName = "ai-gateway-service";
const baseUrl = "http://127.0.0.1:3100";

async function run(command, args, options = {}) {
  const startedAt = Date.now();
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
      ...options,
    });
    return {
      command: [command, ...args].join(" "),
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      command: [command, ...args].join(" "),
      exitCode: typeof error.code === "number" ? error.code : 1,
      durationMs: Date.now() - startedAt,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
    };
  }
}

async function fetchWithRetry(url, options = {}) {
  const attempts = options.attempts ?? 60;
  const delayMs = options.delayMs ?? 1000;
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await fetchText(url, options.timeoutMs ?? 3000);
      if (result.ok) {
        return result;
      }
      lastError = `HTTP ${result.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }
  return { ok: false, status: null, text: "", error: lastError };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tailLines(text, count = 40) {
  return String(text ?? "").trim().split(/\r?\n/).filter(Boolean).slice(-count);
}

async function isPortOccupiedBeforeCompose() {
  try {
    const health = await fetchText(`${baseUrl}/health/check`, 1000);
    return health.ok;
  } catch {
    return false;
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const commands = {};
  let composeLogs = "";
  let smoke = {};

  try {
    const [rootPackageText, servicePackageText, readme, agents, composeFile] =
      await Promise.all([
        readFile(resolve(repoRoot, "package.json"), "utf8"),
        readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
        readFile(resolve(repoRoot, "README.md"), "utf8"),
        readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
        readFile(resolve(repoRoot, "docker-compose.yml"), "utf8"),
      ]);
    const rootPackage = JSON.parse(rootPackageText);
    const servicePackage = JSON.parse(servicePackageText);

    commands.composeVersion = await run("docker", ["compose", "version"]);
    commands.dockerInfo = await run("docker", [
      "info",
      "--format",
      "OSType={{.OSType}} Driver={{.Driver}} Isolation={{.Isolation}}",
    ]);
    commands.composeConfig = await run("docker", [
      "compose",
      "-p",
      composeProject,
      "config",
    ]);
    commands.composeDownBefore = await run("docker", [
      "compose",
      "-p",
      composeProject,
      "down",
      "--remove-orphans",
    ]);

    const portWasOccupied = await isPortOccupiedBeforeCompose();
    if (portWasOccupied) {
      throw new Error(
        "Port 3100 is already serving before Compose startup. Stop the local pnpm service first.",
      );
    }

    commands.composeUp = await run("docker", [
      "compose",
      "-p",
      composeProject,
      "up",
      "--build",
      "-d",
      serviceName,
    ]);
    if (commands.composeUp.exitCode !== 0) {
      throw new Error("docker compose up failed");
    }

    const health = await fetchWithRetry(`${baseUrl}/health/check`);
    const setup = health.ok
      ? await fetchWithRetry(`${baseUrl}/setup/readiness`, { attempts: 5 })
      : { ok: false, status: null, text: "", error: "health did not pass" };
    const ui = health.ok
      ? await fetchWithRetry(`${baseUrl}/ui`, { attempts: 5 })
      : { ok: false, status: null, text: "", error: "health did not pass" };

    commands.composePs = await run("docker", [
      "compose",
      "-p",
      composeProject,
      "ps",
    ]);
    commands.composeLogs = await run("docker", [
      "compose",
      "-p",
      composeProject,
      "logs",
      "--tail",
      "120",
      serviceName,
    ]);
    composeLogs = commands.composeLogs.stdout || commands.composeLogs.stderr || "";

    const healthJson = parseJson(health.text);
    const setupJson = parseJson(setup.text);
    smoke = {
      healthStatus: health.status,
      healthServiceStatus: healthJson?.data?.status ?? null,
      setupStatus: setup.status,
      setupReadinessStatus: setupJson?.data?.status ?? null,
      uiStatus: ui.status,
      uiLength: ui.text.length,
    };

    const combinedForSecretScan = [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      composeFile,
      commands.composeVersion.stdout,
      commands.dockerInfo.stdout,
      health.text,
      setup.text,
      composeLogs,
    ].join("\n\n");
    const secretFindings = findPlainSecretFindings(
      combinedForSecretScan,
      "phase116a-docker-compose-runtime",
    );

    const checks = {
      rootScriptPresent:
        rootPackage.scripts?.["verify:phase116a-docker-compose-runtime"] ===
        "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase116a-docker-compose-runtime",
      serviceScriptPresent:
        servicePackage.scripts?.["verify:phase116a-docker-compose-runtime"] ===
        "node ./src/entrypoints/verifyDockerComposeRuntime.js",
      composeFilePresent: existsSync(resolve(repoRoot, "docker-compose.yml")),
      composeServicePresent: composeFile.includes("ai-gateway-service"),
      composePortMapped: composeFile.includes('"3100:3100"'),
      composeVersionAvailable: commands.composeVersion.exitCode === 0,
      linuxEngineActive: commands.dockerInfo.stdout.includes("OSType=linux"),
      composeConfigPassed: commands.composeConfig.exitCode === 0,
      portAvailableBeforeCompose: !portWasOccupied,
      composeUpPassed: commands.composeUp.exitCode === 0,
      healthCheckPassed:
        health.ok &&
        healthJson?.status === "ok" &&
        healthJson?.data?.status === "ready",
      setupReadinessPassed:
        setup.ok &&
        setupJson?.status === "ok" &&
        setupJson?.data?.status === "ready",
      uiPassed: ui.ok && ui.text.includes("<!doctype html>"),
      readmePhasePresent:
        readme.includes("Phase 116A") &&
        readme.includes("verify:phase116a-docker-compose-runtime"),
      agentsBoundaryPresent:
        agents.includes("Phase 116A Docker Compose Runtime Boundary") &&
        agents.includes("verify:phase116a-docker-compose-runtime"),
      noPlainSecrets: secretFindings.length === 0,
      projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
    };
    const passed = Object.values(checks).every(Boolean);
    const evidence = {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt,
      checks,
      dockerCompose: {
        project: composeProject,
        service: serviceName,
        baseUrl,
        engine: commands.dockerInfo.stdout.trim(),
        composePsTail: tailLines(commands.composePs.stdout || commands.composePs.stderr),
        composeLogTail: tailLines(composeLogs),
      },
      smoke,
      safety: {
        realProviderCalled: false,
        plaintextApiKeyRecorded: false,
        dockerComposeRuntimePassed: passed,
        cloudDeploymentComplete: false,
        realCiCreated: false,
        globalReleaseComplete: false,
      },
      secretFindingCount: secretFindings.length,
      conclusion: passed
        ? "docker-compose-runtime-passed"
        : "docker-compose-runtime-failed",
    };
    await saveEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    const logs = await run("docker", [
      "compose",
      "-p",
      composeProject,
      "logs",
      "--tail",
      "120",
      serviceName,
    ]);
    composeLogs = logs.stdout || logs.stderr || composeLogs;
    const evidence = {
      phase,
      status: "failed",
      generatedAt,
      checks: {
        linuxEngineActive: commands.dockerInfo?.stdout?.includes("OSType=linux") ?? false,
        composeUpPassed: commands.composeUp?.exitCode === 0,
      },
      dockerCompose: {
        project: composeProject,
        service: serviceName,
        baseUrl,
        engine: commands.dockerInfo?.stdout?.trim() ?? "",
        composeUpTail: tailLines(commands.composeUp?.stdout || commands.composeUp?.stderr || ""),
        composeLogTail: tailLines(composeLogs),
      },
      smoke,
      error: error instanceof Error ? error.message : String(error),
      conclusion: "docker-compose-runtime-failed",
    };
    await saveEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  } finally {
    await run("docker", [
      "compose",
      "-p",
      composeProject,
      "down",
      "--remove-orphans",
    ]);
  }
}

async function saveEvidence(evidence) {
  await writeEvidenceWithRenderer(
    evidenceDir,
    resolve(evidenceDir, `${phase}.json`),
    resolve(evidenceDir, `${phase}.md`),
    evidence,
    markdown,
  );
}

function markdown(evidence) {
  return [
    "# Phase 116A Docker Compose Runtime Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Compose project: ${evidence.dockerCompose?.project ?? ""}`,
    `- Service: ${evidence.dockerCompose?.service ?? ""}`,
    `- Engine: ${evidence.dockerCompose?.engine ?? ""}`,
    `- Health status: ${evidence.smoke?.healthStatus ?? "n/a"}`,
    `- Setup readiness status: ${evidence.smoke?.setupStatus ?? "n/a"}`,
    `- UI status: ${evidence.smoke?.uiStatus ?? "n/a"}`,
    `- Plain secret findings: ${evidence.secretFindingCount ?? 0}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks ?? {}).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
    "## Boundaries",
    "",
    "- This is a local Docker Compose runtime validation only.",
    "- It is not cloud deployment, CI/CD completion, production deployment, or global release.",
    "- The smoke checks use local service readiness and do not call real providers.",
    "",
  ].join("\n");
}

await main();
