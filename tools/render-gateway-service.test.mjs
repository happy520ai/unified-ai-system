import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { renderGatewayService } from "./render-gateway-service.mjs";

const linux = { platform: "linux", node: "/usr/bin/node", "install-root": "/opt/UAI fixed", "private-env-file": "/private/gateway.env" };
const windows = { platform: "windows", node: "C:\\Program Files\\nodejs\\node.exe", "install-root": "E:\\UAI fixed", "private-env-file": "E:\\Private state\\gateway.env", user: "MACHINE\\operator" };
const unescapeXml = (value) => value.replaceAll("&quot;", '"').replaceAll("&apos;", "'")
  .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

test("systemd user/system output directly runs the Gateway with a required private env file", () => {
  const user = renderGatewayService(linux);
  assert.match(user, /ExecStart="\/usr\/bin\/node" "--env-file=\/private\/gateway.env" "\/opt\/UAI fixed\/apps\/ai-gateway-service\/src\/index.js"/);
  assert.match(user, /WorkingDirectory="\/opt\/UAI fixed"/);
  assert.match(user, /WantedBy=default.target/);
  assert.match(user, /TimeoutStopSec=15/);
  assert.match(user, /StandardOutput=journal/);
  assert.doesNotMatch(user, /User=|\/var\/log|mcp-service|supervisor|env-file-if-exists/);
  const system = renderGatewayService({ ...linux, scope: "system", user: "uai-gateway" });
  assert.match(system, /User=uai-gateway/);
  assert.match(system, /WantedBy=multi-user.target/);
  assert.throws(() => renderGatewayService({ ...linux, scope: "system" }), /non-root/);
  assert.throws(() => renderGatewayService({ ...linux, scope: "system", user: "root" }), /non-root/);
});

test("systemd command words escape specifiers and variables separately from WorkingDirectory", () => {
  const unit = renderGatewayService({ ...linux, "install-root": "/opt/UAI% $literal", "private-env-file": "/private/%env $file" });
  assert.match(unit, /"--env-file=\/private\/%%env \$\$file"/);
  assert.match(unit, /"\/opt\/UAI%% \$\$literal\/apps\/ai-gateway-service\/src\/index.js"/);
  assert.match(unit, /WorkingDirectory="\/opt\/UAI%% \$literal"/);
  assert.throws(() => renderGatewayService({ ...linux, node: "/opt/$node" }), /dollar sign/);
  assert.throws(() => renderGatewayService({ ...linux, "private-env-file": '/private/"quoted".env' }), /unsupported path/);
});

test("Windows XML keeps one user task and quoted argv without a shell", () => {
  const task = renderGatewayService({ ...windows, "install-root": "E:\\UAI & Co", user: "MACHINE\\A&B" });
  assert.match(task, /<Command>C:\\Program Files\\nodejs\\node.exe<\/Command>/);
  const argumentsText = unescapeXml(task.match(/<Arguments>(.*?)<\/Arguments>/s)[1]);
  assert.equal(argumentsText, '"--env-file=E:\\Private state\\gateway.env" "E:\\UAI & Co\\apps\\ai-gateway-service\\src\\index.js"');
  assert.match(task, /MACHINE\\A&amp;B/);
  assert.match(task, /<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);
  assert.match(task, /<LogonType>InteractiveToken<\/LogonType><RunLevel>LeastPrivilege/);
  assert.match(task, /<ExecutionTimeLimit>PT0S/);
  assert.doesNotMatch(task, /powershell|cmd\.exe|Register-ScheduledTask|mcp-service|env-file-if-exists/i);
  assert.throws(() => renderGatewayService({ ...windows, "private-env-file": "E:\\%USERPROFILE%\\gateway.env" }), /expansion markers/);
});

test("LaunchAgent uses separate plist argv, escaped paths and top-level restart timing", () => {
  const plist = renderGatewayService({ ...linux, platform: "macos", "install-root": "/Users/operator/UAI & Co", "log-dir": "/Users/operator/private logs" });
  assert.match(plist, /<string>--env-file=\/private\/gateway.env<\/string>/);
  assert.match(plist, /<string>\/Users\/operator\/UAI &amp; Co\/apps\/ai-gateway-service\/src\/index.js<\/string>/);
  assert.match(plist, /<key>KeepAlive<\/key><dict><key>SuccessfulExit<\/key><false\/><\/dict>\n  <key>ThrottleInterval<\/key><integer>5/);
  assert.match(plist, /<key>ExitTimeOut<\/key><integer>15/);
  assert.match(plist, /<key>Label<\/key><string>io.github.happy520ai.unified-ai-system-gateway/);
  assert.doesNotMatch(plist, /launchctl|mcp-service|EnvironmentVariables/);
});

test("rejects relative/traversal/control paths, invalid platforms and unsupported scopes", () => {
  for (const change of [
    { node: "node" }, { "install-root": "/opt/old/../current" }, { "private-env-file": "/private/file\nextra" },
    { platform: "unknown" }, { scope: "other" }, { "state-root": "/pretend" },
    { platform: "macos", scope: "system" }, { user: "unexpected-user" }, { scope: "system", user: "uai\n" },
  ]) assert.throws(() => renderGatewayService({ ...linux, ...change }));
});

test("actual renderer CLI succeeds with an absent private env file and performs no runtime launch", () => {
  const missing = `/owned-nonexistent-${randomUUID()}/gateway.env`;
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (/^(PATH|SYSTEMROOT|WINDIR|PATHEXT)$/i.test(key)) env[key] = value;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./render-gateway-service.mjs", import.meta.url)),
    "--platform", "linux", "--node", "/usr/bin/node", "--install-root", "/opt/uai", "--private-env-file", missing],
  { env, encoding: "utf8", windowsHide: true, timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.ok(result.stdout.includes(`--env-file=${missing}`));
  assert.match(result.stdout, /^\[Unit\]/);
});

const kubeOptions = { platform: "kubernetes", image: `ghcr.io/example/gateway@sha256:${"1".repeat(64)}`,
  namespace: "uai-fixture", "storage-class": "fixture-csi", "storage-size": "5Gi" };

test("Kubernetes output binds one writer to retained claims and references authentication without embedding it", () => {
  const result = JSON.parse(renderGatewayService(kubeOptions));
  assert.equal(result.kind, "List");
  const claims = result.items.filter(item => item.kind === "PersistentVolumeClaim");
  const deployment = result.items.find(item => item.kind === "Deployment");
  const service = result.items.find(item => item.kind === "Service");
  assert.equal(result.items.length, 4);
  assert.equal(claims.length, 2);
  assert.ok(claims.every(claim => claim.spec.accessModes.join() === "ReadWriteOncePod"));
  assert.equal(deployment.spec.replicas, 1);
  assert.deepEqual(deployment.spec.strategy, { type: "Recreate" });
  const pod = deployment.spec.template.spec;
  assert.deepEqual(pod.nodeSelector, { "kubernetes.io/os": "linux" });
  assert.equal(pod.os.name, "linux");
  assert.equal(pod.automountServiceAccountToken, false);
  assert.equal(pod.securityContext.runAsUser, 1000);
  for (const container of [...pod.initContainers, ...pod.containers]) {
    assert.equal(container.image, kubeOptions.image);
    assert.equal(container.securityContext.readOnlyRootFilesystem, true);
    assert.equal(container.securityContext.allowPrivilegeEscalation, false);
  }
  const gateway = pod.containers[0];
  const auth = gateway.env.find(entry => entry.name === "PME_AUTH_TOKEN");
  assert.equal(auth.value, undefined);
  assert.deepEqual(auth.valueFrom, { secretKeyRef: { name: "uai-gateway-auth", key: "PME_AUTH_TOKEN" } });
  assert.equal(gateway.env.find(entry => entry.name === "AI_GATEWAY_REAL_PROVIDER_ENABLED").value, "false");
  assert.equal(gateway.readinessProbe.httpGet.path, "/ready");
  assert.equal(gateway.livenessProbe.httpGet.path, "/livez");
  assert.equal(service.spec.type, "ClusterIP");
  const claimNames = new Set(claims.map(claim => claim.metadata.name));
  assert.ok(pod.volumes.filter(volume => volume.persistentVolumeClaim).every(volume => claimNames.has(volume.persistentVolumeClaim.claimName)));
  assert.ok(gateway.volumeMounts.some(mount => mount.mountPath.endsWith("/evidence/response-cache") && mount.subPath === "response-cache"));
  assert.ok(pod.initContainers[0].command.at(-1).includes("/state/response-cache"));
  assert.ok(result.items.every(item => item.metadata.namespace === kubeOptions.namespace));
  assert.deepEqual(deployment.spec.selector.matchLabels, deployment.spec.template.metadata.labels);
  assert.deepEqual(service.spec.selector, deployment.spec.selector.matchLabels);
});

test("Kubernetes rejects mutable images, malformed storage and mixed native options", () => {
  for (const change of [
    { image: "ghcr.io/example/gateway:latest" }, { image: `https://user:pass@host/image@sha256:${"1".repeat(64)}` },
    { namespace: "bad.namespace" }, { namespace: "../default" }, { namespace: "default\n" },
    { "storage-class": "" }, { "storage-class": "a..b" }, { "storage-size": "0Gi" },
    { "storage-size": "5Gi\n" }, { "storage-size": "1Ti" }, { node: "/usr/bin/node" },
    { "private-env-file": "/private/gateway.env" }, { replicas: "2" },
  ]) assert.throws(() => renderGatewayService({ ...kubeOptions, ...change }));
  assert.throws(() => renderGatewayService({ ...linux, image: kubeOptions.image }));
});
