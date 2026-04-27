import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-115a-docker-runtime-recheck";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const imageTag = "unified-ai-system-ai-gateway-service:phase115a";
const containerName = `unified-ai-system-phase115a-${Date.now()}`;

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
      const response = await fetch(url);
      const text = await response.text();
      if (response.ok) {
        return { ok: true, status: response.status, text };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }
  return { ok: false, status: null, text: "", error: lastError };
}

function parseDockerPort(text) {
  const firstLine = String(text).trim().split(/\r?\n/)[0] ?? "";
  const match = firstLine.match(/:(\d+)$/);
  return match?.[1] ?? "";
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tailLines(text, count = 40) {
  return String(text ?? "").trim().split(/\r?\n/).slice(-count);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const commands = {};
  let dockerLogs = "";
  let hostPort = "";

  try {
    commands.dockerVersion = await run("docker", ["--version"]);
    commands.composeVersion = await run("docker", ["compose", "version"]);
    commands.dockerPs = await run("docker", ["ps"]);
    commands.dockerInfo = await run("docker", [
      "info",
      "--format",
      "OSType={{.OSType}} Driver={{.Driver}} Isolation={{.Isolation}}",
    ]);

    commands.dockerBuild = await run("docker", ["build", "-t", imageTag, "."]);
    if (commands.dockerBuild.exitCode !== 0) {
      throw new Error("docker build failed");
    }

    commands.dockerRun = await run("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      "127.0.0.1::3100",
      imageTag,
    ]);
    if (commands.dockerRun.exitCode !== 0) {
      throw new Error("docker run failed");
    }

    commands.dockerPort = await run("docker", ["port", containerName, "3100/tcp"]);
    hostPort = parseDockerPort(commands.dockerPort.stdout);
    if (!hostPort) {
      throw new Error("docker host port was not reported");
    }

    const baseUrl = `http://127.0.0.1:${hostPort}`;
    const health = await fetchWithRetry(`${baseUrl}/health/check`);
    const setup = health.ok
      ? await fetchWithRetry(`${baseUrl}/setup/readiness`, { attempts: 5 })
      : { ok: false, status: null, text: "", error: "health did not pass" };
    const ui = health.ok
      ? await fetchWithRetry(`${baseUrl}/ui`, { attempts: 5 })
      : { ok: false, status: null, text: "", error: "health did not pass" };

    commands.dockerLogs = await run("docker", ["logs", "--tail", "120", containerName]);
    dockerLogs = commands.dockerLogs.stdout || commands.dockerLogs.stderr || "";

    const healthJson = parseJson(health.text);
    const setupJson = parseJson(setup.text);
    const secretFindings = findPlainSecretFindings(
      [
        commands.dockerVersion.stdout,
        commands.composeVersion.stdout,
        commands.dockerInfo.stdout,
        health.text,
        setup.text,
        dockerLogs,
      ].join("\n\n"),
      "phase115a-docker-runtime-recheck",
    );

    const checks = {
      dockerCliAvailable: commands.dockerVersion.exitCode === 0,
      dockerComposeAvailable: commands.composeVersion.exitCode === 0,
      dockerDaemonAvailable: commands.dockerPs.exitCode === 0,
      linuxEngineActive: commands.dockerInfo.stdout.includes("OSType=linux"),
      dockerBuildPassed: commands.dockerBuild.exitCode === 0,
      dockerRunPassed: commands.dockerRun.exitCode === 0,
      healthCheckPassed:
        health.ok &&
        healthJson?.status === "ok" &&
        healthJson?.data?.status === "ready",
      setupReadinessPassed:
        setup.ok &&
        setupJson?.status === "ok" &&
        setupJson?.data?.status === "ready",
      uiPassed: ui.ok && ui.text.includes("<!doctype html>"),
      noPlainSecrets: secretFindings.length === 0,
    };
    const passed = Object.values(checks).every(Boolean);

    const evidence = {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt,
      checks,
      docker: {
        imageTag,
        containerName,
        hostPort,
        engine: commands.dockerInfo.stdout.trim(),
        buildOutputTail: tailLines(commands.dockerBuild.stdout || commands.dockerBuild.stderr),
        containerLogTail: tailLines(dockerLogs),
      },
      smoke: {
        healthStatus: health.status,
        healthServiceStatus: healthJson?.data?.status ?? null,
        setupStatus: setup.status,
        setupReadinessStatus: setupJson?.data?.status ?? null,
        uiStatus: ui.status,
        uiLength: ui.text.length,
      },
      safety: {
        realProviderCalled: false,
        plaintextApiKeyRecorded: false,
        dockerRuntimePassed: passed,
        cloudDeploymentComplete: false,
        realCiCreated: false,
        globalReleaseComplete: false,
      },
      secretFindingCount: secretFindings.length,
      conclusion: passed
        ? "docker-runtime-recheck-passed"
        : "docker-runtime-recheck-failed",
    };
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    if (!dockerLogs) {
      const logs = await run("docker", ["logs", "--tail", "120", containerName]);
      dockerLogs = logs.stdout || logs.stderr || "";
    }
    const evidence = {
      phase,
      status: "failed",
      generatedAt,
      checks: {
        dockerBuildPassed: commands.dockerBuild?.exitCode === 0,
        dockerRunPassed: commands.dockerRun?.exitCode === 0,
      },
      docker: {
        imageTag,
        containerName,
        hostPort,
        engine: commands.dockerInfo?.stdout?.trim() ?? "",
        buildOutputTail: tailLines(
          commands.dockerBuild?.stdout || commands.dockerBuild?.stderr || "",
        ),
        containerLogTail: tailLines(dockerLogs),
      },
      error: error instanceof Error ? error.message : String(error),
      conclusion: "docker-runtime-recheck-failed",
    };
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  } finally {
    await run("docker", ["rm", "-f", containerName]);
  }
}

async function writeEvidence(evidence) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, `${phase}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  await writeFile(resolve(evidenceDir, `${phase}.md`), markdown(evidence), "utf8");
}

function markdown(evidence) {
  return [
    "# Phase 115A Docker Runtime Recheck Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Engine: ${evidence.docker?.engine ?? ""}`,
    `- Image tag: ${evidence.docker?.imageTag ?? ""}`,
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
    "- This is a local Docker build/run validation only.",
    "- It is not cloud deployment, CI/CD completion, production deployment, or global release.",
    "- The smoke checks use local service readiness and do not call real providers.",
    "",
  ].join("\n");
}

await main();
