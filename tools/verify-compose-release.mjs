#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const profilePath = join(root, "deploy/compose.release.json");
const syntheticToken = "compose-configuration-validation-only";
let ownedDirectory;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateDigestReference(value) {
  const match = /^([^@\s]+)@sha256:([a-f0-9]{64})$/.exec(value);
  requireCondition(match && match[0] === value && value.length <= 320, "--image requires repository@sha256 followed by 64 lowercase hexadecimal characters.");
  const parts = match[1].split("/");
  if (parts.length > 1 && /[.:]/.test(parts[0])) {
    const registry = /^([a-z0-9]+(?:[.-][a-z0-9]+)*)(?::([0-9]{1,5}))?$/.exec(parts.shift());
    requireCondition(registry && (!registry[2] || (Number(registry[2]) >= 1 && Number(registry[2]) <= 65535)), "Unsupported registry host or port.");
  }
  requireCondition(parts.length > 0 && parts.every((part) => /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/.test(part)), "Unsupported repository syntax; mutable tags and credential-bearing references are rejected.");
}

function checkModel(model, imageReference, port, normalized) {
  requireCondition(!model.include && !model.configs && !model.secrets, "External Compose includes, configs and secrets are not permitted in this profile.");
  requireCondition(Object.keys(model.services ?? {}).join() === "ai-gateway-service", "Expected exactly one Gateway service.");
  const service = model.services["ai-gateway-service"];
  requireCondition(!service.build && !service.env_file && !service.extends && !service.configs && !service.secrets && !service.privileged && !service.devices, "Build, external configuration, privileged mode and devices are not permitted.");
  requireCondition(service.user === "node" && service.init === true && service.read_only === true, "Non-root, init and read-only root filesystem are required.");
  requireCondition(service.cap_drop?.includes("ALL") && service.security_opt?.includes("no-new-privileges:true"), "Container capability restrictions are required.");
  requireCondition(service.tmpfs?.includes("/tmp:rw,noexec,nosuid,size=64m"), "Expected restricted temporary filesystem.");
  requireCondition(service.deploy?.replicas === 1, "This release profile supports one active Gateway replica.");
  requireCondition(service.restart === "unless-stopped" && service.stop_grace_period === "15s", "Expected restart policy and bounded shutdown grace.");
  requireCondition(service.healthcheck?.test?.join(" ").includes("http://127.0.0.1:3100/ready"), "Readiness must be the container health probe.");
  requireCondition(service.environment?.PME_ENTERPRISE_AUTH_ENABLED === "true" && service.environment?.AI_GATEWAY_PROVIDER_MODE === "fake", "Authenticated fake-provider defaults are required.");
  requireCondition(Object.keys(model.volumes ?? {}).sort().join() === "gateway-data,gateway-service-data", "Expected both existing Gateway data volumes.");
  if (!normalized) {
    requireCondition(Object.values(model.volumes).every((volume) => volume && Object.keys(volume).length === 0), "Data volumes must use the default named-volume configuration.");
    requireCondition(service.image === "${UAI_GATEWAY_IMAGE:?Set UAI_GATEWAY_IMAGE to a verified repository@sha256 digest}", "Image must be explicitly supplied.");
    requireCondition(service.volumes?.join() === "gateway-data:/app/.data,gateway-service-data:/app/apps/ai-gateway-service/.data", "Only the two named data mounts are permitted.");
    return;
  }
  requireCondition(service.image === imageReference && service.environment.PME_AUTH_TOKEN === syntheticToken, "Interpolation did not use the isolated validation environment.");
  requireCondition(service.ports?.length === 1 && service.ports[0].host_ip === "127.0.0.1" && String(service.ports[0].published) === port && service.ports[0].target === 3100, "Expected one loopback-only Gateway port.");
  requireCondition(service.volumes?.length === 2 && service.volumes.every((volume) => volume.type === "volume" && ((volume.source === "gateway-data" && volume.target === "/app/.data") || (volume.source === "gateway-service-data" && volume.target === "/app/apps/ai-gateway-service/.data"))), "Normalized data mounts changed.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write("Usage: node tools/verify-compose-release.mjs --image repository@sha256:<64 hex> [--port 3100]\nValidates configuration only; does not pull images or start services.\n");
  } else {
    requireCondition((args.length === 2 || args.length === 4) && args[0] === "--image" && (args.length === 2 || args[2] === "--port"), "Expected --image <digest reference> and optional --port <1..65535>.");
    const imageReference = args[1];
    const port = args[3] ?? "3100";
    validateDigestReference(imageReference);
    requireCondition(/^[1-9][0-9]{0,4}$/.test(port) && Number(port) <= 65535, "--port must be an integer from 1 through 65535.");
    checkModel(JSON.parse(readFileSync(profilePath, "utf8")), imageReference, port, false);
    ownedDirectory = mkdtempSync(join(realpathSync(tmpdir()), "uai-compose-config-"));
    const dockerConfig = join(ownedDirectory, "docker");
    mkdirSync(dockerConfig);
    writeFileSync(join(dockerConfig, "config.json"), '{"auths":{}}\n', { mode: 0o600 });
    const emptyEnvFile = join(ownedDirectory, "empty.env");
    const emptyNpmConfig = join(ownedDirectory, "empty.npmrc");
    writeFileSync(emptyEnvFile, "", { mode: 0o600 });
    writeFileSync(emptyNpmConfig, "", { mode: 0o600 });
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432)$/i.test(key)) env[key] = value;
    }
    Object.assign(env, {
      HOME: ownedDirectory, USERPROFILE: ownedDirectory, APPDATA: ownedDirectory, LOCALAPPDATA: ownedDirectory,
      XDG_CONFIG_HOME: ownedDirectory, TMPDIR: ownedDirectory, TMP: ownedDirectory, TEMP: ownedDirectory,
      DOCKER_CONFIG: dockerConfig, COMPOSE_DISABLE_ENV_FILE: "1", NPM_CONFIG_USERCONFIG: emptyNpmConfig,
      NPM_CONFIG_GLOBALCONFIG: emptyNpmConfig, UAI_GATEWAY_IMAGE: imageReference, UAI_GATEWAY_PORT: port,
      PME_AUTH_TOKEN: syntheticToken,
    });
    const result = spawnSync(process.platform === "win32" ? "docker.exe" : "docker", [
      "--config", dockerConfig, "compose", "--env-file", emptyEnvFile,
      "--project-name", "uai-profile-validation", "--project-directory", root, "-f", profilePath,
      "config", "--format", "json",
    ], { cwd: ownedDirectory, env, encoding: "utf8", windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 });
    requireCondition(!result.error && result.status === 0, "Docker Compose configuration validation failed; install a compatible Compose v2 CLI. Output is suppressed to avoid exposing interpolated data.");
    checkModel(JSON.parse(result.stdout), imageReference, port, true);
    process.stdout.write(`${JSON.stringify({ status: "passed", image: imageReference, port: Number(port), replicas: 1, providerMode: "fake", probe: "/ready", isolatedEnvironment: true, serviceStarted: false }, null, 2)}\n`);
  }
} catch (error) {
  // JSON parse errors can include source snippets; never echo arbitrary tool/config content.
  const message = error instanceof SyntaxError ? "Invalid JSON in the profile or normalized Compose output." : error.message;
  process.stderr.write(`Compose release validation failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  if (ownedDirectory) {
    const target = resolve(ownedDirectory);
    if (basename(target).startsWith("uai-compose-config-") && !lstatSync(target).isSymbolicLink()
      && realpathSync(target) === target && dirname(target) === realpathSync(tmpdir())) {
      rmSync(target, { recursive: true, force: true });
    } else {
      process.stderr.write("Owned validation directory could not be safely removed.\n");
      process.exitCode = 1;
    }
  }
}
}
