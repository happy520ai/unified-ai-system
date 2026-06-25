import { execFile } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchText, listen, close, findBrowserPath } from "./entrypointUtils.js";

const execFileAsync = promisify(execFile);
const PHASE = "phase-52a-web-browser-visual";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-52a-web-browser-visual.json");
const evidenceMdPath = resolve(evidenceDir, "phase-52a-web-browser-visual.md");
const evidencePngPath = resolve(evidenceDir, "phase-52a-web-browser-visual.png");

let server;
let evidence;

try {
  const browserPath = findBrowserPath();
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const uiUrl = `${serviceUrl}/ui`;
  const ui = await fetchText(uiUrl);

  await mkdir(evidenceDir, { recursive: true });
  await execFileAsync(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--window-size=1440,1200",
    `--screenshot=${evidencePngPath}`,
    uiUrl,
  ], {
    cwd: repoRoot,
    timeout: 45000,
    maxBuffer: 1024 * 1024,
  });

  const screenshot = await inspectPng(evidencePngPath);
  const requiredText = [
    "PME 移动地球",
    "直接问，直接丢文件",
    "日常最推荐顺序",
    "高级能力也通过聊天进入",
    "cmd /c pnpm dev:phase7b",
    "cmd /c pnpm status:phase10a",
    "cmd /c pnpm health:phase12a",
    "cmd /c pnpm logs:phase16a",
    "cmd /c pnpm idle:phase15a",
  ];
  const missingText = requiredText.filter((item) => !ui.text.includes(item));
  const passed = ui.httpStatus === 200 &&
    missingText.length === 0 &&
    screenshot.validPng &&
    screenshot.width >= 1200 &&
    screenshot.height >= 900 &&
    screenshot.bytes > 10000;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    browserPath,
    serviceUrl,
    ui: {
      url: uiUrl,
      httpStatus: ui.httpStatus,
      requiredTextCount: requiredText.length,
      missingText,
      firstScreenMarkerPresent: ui.text.includes("phase51a-user-readable-first-screen"),
      sideHiddenByDefault: ui.text.includes("transform: translateX(105%)"),
    },
    screenshot: {
      path: "apps/ai-gateway-service/evidence/phase-52a-web-browser-visual.png",
      bytes: screenshot.bytes,
      width: screenshot.width,
      height: screenshot.height,
      validPng: screenshot.validPng,
    },
    safety: {
      browserRenderOnly: true,
      backendBusinessRouteAdded: false,
      providerCalls: false,
      runtimeMutation: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
    },
    conclusion: passed ? "web-browser-visual-connected" : "web-browser-visual-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-browser-visual-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}


function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName))
    .reverse();
}

async function inspectPng(path) {
  const stats = await stat(path);
  const buffer = await readFile(path);
  const validPng = buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  return {
    bytes: stats.size,
    width: validPng ? buffer.readUInt32BE(16) : 0,
    height: validPng ? buffer.readUInt32BE(20) : 0,
    validPng,
  };
}

