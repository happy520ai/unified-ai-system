#!/usr/bin/env node
import { posix, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { validateDigestReference } from "./verify-compose-release.mjs";

const label = "io.github.happy520ai.unified-ai-system-gateway";
const nativeOptions = ["platform", "scope", "node", "install-root", "private-env-file", "user", "log-dir"];
const kubernetesOptions = ["platform", "image", "namespace", "storage-class", "storage-size"];
const allowedOptions = new Set([...nativeOptions, ...kubernetesOptions]);
const xml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

function check(condition, message) { if (!condition) throw new Error(message); }
function pathArgument(value, name, windows) {
  const paths = windows ? win32 : posix;
  check(typeof value === "string" && value.length > 0 && value.length <= (windows ? 240 : 2048)
    && !/[\u0000-\u001f\u007f]/u.test(value) && paths.isAbsolute(value), `${name} must be an absolute path without control characters.`);
  check(!value.includes('"') && (!windows || !/[<>|?*]/u.test(value)), `${name} contains unsupported path characters.`);
  const normalized = paths.normalize(value);
  check(normalized === value && !value.endsWith(paths.sep), `${name} must be a normalized path without a trailing separator.`);
  return value;
}
// systemd expands both specifiers and variables after splitting command words.
function systemdWord(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%").replaceAll("$", () => "$$")}"`;
}
function systemdPath(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%")}"`;
}
// Quote one Windows CRT argument; backslashes before the closing quote double.
function windowsArgument(value) {
  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, "$1$1")}"`;
}

/** Pure formatting only: no file reads, process spawning or service registration. */
export function renderGatewayService(options) {
  check(options && Object.keys(options).every((key) => allowedOptions.has(key)), "Unsupported renderer option.");
  const platform = options.platform;
  if (platform === "kubernetes") return renderKubernetesGateway(options);
  check(Object.keys(options).every((key) => nativeOptions.includes(key)), "Kubernetes options cannot configure a native service.");
  check(["linux", "windows", "macos"].includes(platform), "platform must be linux, windows or macos.");
  const windows = platform === "windows";
  const paths = windows ? win32 : posix;
  const node = pathArgument(options.node, "node", windows);
  const root = pathArgument(options["install-root"], "install-root", windows);
  const envFile = pathArgument(options["private-env-file"], "private-env-file", windows);
  const entry = paths.join(root, "apps", "ai-gateway-service", "src", "index.js");
  const args = [`--env-file=${envFile}`, entry];
  const scope = options.scope ?? "user";
  check(scope === "user" || scope === "system", "scope must be user or system.");
  check(platform === "linux" || scope === "user", "Windows and macOS templates support user sessions only.");
  check(!options["log-dir"] || platform === "macos", "log-dir is only supported for macOS.");
  if (platform === "linux") {
    check(!node.includes("$"), "A systemd executable path cannot contain a dollar sign.");
    check(!options.user || scope === "system", "A systemd user unit must not set User=.");
    if (scope === "system") check(typeof options.user === "string" && options.user.trim() === options.user && /^[a-z_][a-z0-9_-]{0,31}$/u.test(options.user)
      && options.user !== "root", "A system unit requires an explicit non-root service user.");
    return ["[Unit]", "Description=Unified AI System Gateway HTTP service", "After=network.target", "",
      "[Service]", "Type=simple", ...(scope === "system" ? [`User=${options.user}`] : []),
      `ExecStart=${[node, ...args].map(systemdWord).join(" ")}`, `WorkingDirectory=${systemdPath(root)}`,
      "Restart=on-failure", "RestartSec=5", "StandardInput=null", "StandardOutput=journal", "StandardError=journal",
      "UMask=0077", "NoNewPrivileges=true", "TimeoutStopSec=15", "KillSignal=SIGTERM", "KillMode=mixed", "",
      "[Install]", `WantedBy=${scope === "user" ? "default.target" : "multi-user.target"}`, ""].join("\n");
  }
  if (windows) {
    check(typeof options.user === "string" && options.user.length > 0 && options.user.length <= 256
      && !/[\u0000-\u001f\u007f]/u.test(options.user), "Windows requires an explicit user account or SID.");
    // Task Scheduler expands environment references independently of argv parsing.
    check(![node, root, envFile].some((value) => value.includes("%")), "Windows paths cannot contain environment expansion markers.");
    // Omitting encoding works for both UTF-8 review files and Task Scheduler's
    // UTF-16 BSTR XmlText API; an explicit UTF-8 declaration is rejected there.
    return ['<?xml version="1.0"?>',
      '<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
      "  <RegistrationInfo><Description>Unified AI System Gateway HTTP service</Description></RegistrationInfo>",
      `  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xml(options.user)}</UserId></LogonTrigger></Triggers>`,
      `  <Principals><Principal id="GatewayUser"><UserId>${xml(options.user)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>`,
      "  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure></Settings>",
      `  <Actions Context="GatewayUser"><Exec><Command>${xml(node)}</Command><Arguments>${xml(args.map(windowsArgument).join(" "))}</Arguments><WorkingDirectory>${xml(root)}</WorkingDirectory></Exec></Actions>`,
      "</Task>", ""].join("\n");
  }
  check(!options.user, "A LaunchAgent uses its GUI session owner; do not supply user.");
  const logDir = pathArgument(options["log-dir"], "log-dir", false);
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>', `  <key>Label</key><string>${label}</string>`,
    "  <key>ProgramArguments</key><array>", ...[node, ...args].map((value) => `    <string>${xml(value)}</string>`), "  </array>",
    `  <key>WorkingDirectory</key><string>${xml(root)}</string>`, "  <key>RunAtLoad</key><true/>",
    "  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>",
    "  <key>ThrottleInterval</key><integer>5</integer>", "  <key>ExitTimeOut</key><integer>15</integer>",
    "  <key>ProcessType</key><string>Background</string>", "  <key>Umask</key><integer>63</integer>",
    `  <key>StandardOutPath</key><string>${xml(paths.join(logDir, "gateway.out.log"))}</string>`,
    `  <key>StandardErrorPath</key><string>${xml(paths.join(logDir, "gateway.err.log"))}</string>`,
    "</dict></plist>", ""].join("\n");
}

function renderKubernetesGateway(options) {
  check(Object.keys(options).every((key) => kubernetesOptions.includes(key)), "Native service options cannot configure Kubernetes.");
  const image = options.image;
  validateDigestReference(image);
  const namespace = options.namespace;
  const storageClassName = options["storage-class"];
  const storage = options["storage-size"];
  const dnsLabel = (value) => typeof value === "string" && value.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(value);
  check(dnsLabel(namespace), "namespace must be an explicit DNS label of at most 63 characters.");
  check(typeof storageClassName === "string" && storageClassName.length <= 253
    && storageClassName.split(".").every(dnsLabel), "storage-class must name an explicit CSI class supporting ReadWriteOncePod.");
  check(typeof storage === "string" && /^[1-9][0-9]{0,3}Gi$/u.test(storage), "storage-size must be an explicit whole Gi quantity from 1Gi through 9999Gi per claim.");
  const labels = { "app.kubernetes.io/name": "uai-gateway" };
  const metadata = (name) => ({ name, namespace, labels });
  const protection = { allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: { drop: ["ALL"] } };
  const pvc = (name) => ({ apiVersion: "v1", kind: "PersistentVolumeClaim", metadata: metadata(name),
    spec: { accessModes: ["ReadWriteOncePod"], storageClassName, resources: { requests: { storage } } } });
  const httpProbe = (path, periodSeconds, failureThreshold) => ({ httpGet: { path, port: "http" }, periodSeconds, timeoutSeconds: 2, failureThreshold });
  return `${JSON.stringify({ apiVersion: "v1", kind: "List", items: [
    pvc("uai-gateway-data"), pvc("uai-gateway-service-data"),
    { apiVersion: "apps/v1", kind: "Deployment", metadata: metadata("uai-gateway"), spec: {
      replicas: 1, strategy: { type: "Recreate" }, revisionHistoryLimit: 2,
      selector: { matchLabels: labels }, template: { metadata: { labels }, spec: {
        nodeSelector: { "kubernetes.io/os": "linux" }, os: { name: "linux" },
        automountServiceAccountToken: false, enableServiceLinks: false, terminationGracePeriodSeconds: 15,
        securityContext: { runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000,
          fsGroupChangePolicy: "OnRootMismatch", seccompProfile: { type: "RuntimeDefault" } },
        initContainers: [{ name: "prepare-cache-directory", image, imagePullPolicy: "IfNotPresent",
          command: ["node", "-e", "require('node:fs').mkdirSync('/state/response-cache',{recursive:true,mode:0o700})"],
          securityContext: protection, resources: { requests: { cpu: "25m", memory: "32Mi" }, limits: { cpu: "250m", memory: "128Mi" } },
          volumeMounts: [{ name: "service-data", mountPath: "/state" }] }],
        containers: [{ name: "gateway", image, imagePullPolicy: "IfNotPresent", securityContext: protection,
          ports: [{ name: "http", containerPort: 3100 }],
          env: [
            { name: "AI_GATEWAY_SERVICE_HOST", value: "0.0.0.0" }, { name: "AI_GATEWAY_SERVICE_PORT", value: "3100" },
            { name: "AI_GATEWAY_PROVIDER_MODE", value: "fake" }, { name: "AI_GATEWAY_REAL_PROVIDER_ENABLED", value: "false" },
            { name: "PME_ENTERPRISE_AUTH_ENABLED", value: "true" }, { name: "AI_GATEWAY_SHUTDOWN_TIMEOUT_MS", value: "10000" },
            { name: "AI_GATEWAY_MODEL_LIBRARY_STATE_PATH", value: "/app/.data/model-library/state.json" },
            { name: "PME_AUTH_TOKEN", valueFrom: { secretKeyRef: { name: "uai-gateway-auth", key: "PME_AUTH_TOKEN" } } },
          ],
          resources: { requests: { cpu: "100m", memory: "256Mi" }, limits: { cpu: "2", memory: "1Gi" } },
          startupProbe: httpProbe("/ready", 5, 36), readinessProbe: httpProbe("/ready", 5, 3), livenessProbe: httpProbe("/livez", 10, 3),
          volumeMounts: [{ name: "data", mountPath: "/app/.data" }, { name: "service-data", mountPath: "/app/apps/ai-gateway-service/.data" },
            { name: "service-data", mountPath: "/app/apps/ai-gateway-service/evidence/response-cache", subPath: "response-cache" },
            { name: "temporary", mountPath: "/tmp" }],
        }],
        volumes: [{ name: "data", persistentVolumeClaim: { claimName: "uai-gateway-data" } },
          { name: "service-data", persistentVolumeClaim: { claimName: "uai-gateway-service-data" } },
          { name: "temporary", emptyDir: { medium: "Memory", sizeLimit: "64Mi" } }],
      } } } },
    { apiVersion: "v1", kind: "Service", metadata: metadata("uai-gateway"),
      spec: { type: "ClusterIP", selector: labels, ports: [{ name: "http", port: 3100, targetPort: "http" }] } },
  ] }, null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const argv = process.argv.slice(2);
    if (argv.length === 1 && argv[0] === "--help") {
      process.stdout.write("Usage: node tools/render-gateway-service.mjs --platform linux|windows|macos --node ABSOLUTE_PATH --install-root FIXED_ABSOLUTE_PATH --private-env-file PRIVATE_ABSOLUTE_PATH [--scope user|system] [--user ACCOUNT] [--log-dir ABSOLUTE_PATH]\nKubernetes: --platform kubernetes --image REPOSITORY@sha256:DIGEST --namespace NAME --storage-class CSI_CLASS --storage-size 5Gi\nPrints a service template only; does not read credentials, install or start anything.\n");
    } else {
      check(argv.length > 0 && argv.length % 2 === 0, "Expected --option value pairs.");
      const options = {};
      for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index].slice(2);
        check(argv[index].startsWith("--") && allowedOptions.has(key) && !(key in options), "Unknown or duplicate option.");
        options[key] = argv[index + 1];
      }
      process.stdout.write(renderGatewayService(options));
    }
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
