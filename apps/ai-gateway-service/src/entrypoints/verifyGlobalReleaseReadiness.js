import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-78a-global-release-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-78a-global-release-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-78a-global-release-readiness.md");

const requiredDocs = [
  "README.md",
  "AGENTS.md",
  "docs/DELIVERY_GUIDE.md",
  "docs/OPERATION_MANUAL.md",
  "docs/GLOBAL_RELEASE_READINESS.md",
];
const requiredRootScripts = [
  "help:phase14a",
  "start:pme",
  "dev:phase7b",
  "status:phase10a",
  "health:phase12a",
  "logs:phase16a",
  "idle:phase15a",
  "verify:phase21",
  "verify:phase22",
  "verify:phase23",
  "verify:phase24",
  "verify:phase50a",
  "verify:phase76s",
  "verify:phase77a",
  "verify:phase78a",
  "verify:phase79a",
  "verify:phase80a",
  "verify:phase81a",
  "verify:phase82a",
  "verify:phase83a",
  "verify:phase84a",
  "verify:phase85a",
  "verify:phase86a",
  "verify:phase87a",
  "verify:phase88a",
  "verify:phase89a",
  "verify:phase90a",
  "verify:phase91a",
  "verify:phase92a",
  "verify:phase93a",
  "verify:phase94a",
  "verify:phase95a",
  "verify:phase96a",
  "verify:phase97a",
  "verify:phase98a",
  "verify:phase99a",
  "verify:phase100a",
  "verify:phase101a",
  "verify:phase8a-model-import",
  "verify:enterprise",
];
const mojibakeMarkers = ["绉", "鏃", "榛", "浼", "鐭", "鍏", "褰", "锟", "�"];
const secretPatterns = [
  { name: "gemini-api-key", pattern: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: "nvidia-api-key", pattern: /nvapi-[0-9A-Za-z_-]{20,}/gi },
  { name: "generic-sk-key", pattern: /sk-[0-9A-Za-z]{24,}/g },
  {
    name: "postgres-connection-with-password",
    pattern: /postgres(?:ql)?:\/\/[^:\s/]+:[^<\s>@][^@\s]*@/gi,
  },
];

let evidence;

try {
  const rootPackage = JSON.parse(await readText("package.json"));
  const docs = await Promise.all(requiredDocs.map(readDocStatus));
  const docTexts = Object.fromEntries(
    await Promise.all(requiredDocs.map(async (path) => [path, existsSync(resolve(repoRoot, path)) ? await readText(path) : ""])),
  );
  const evidenceFiles = await listEvidenceTextFiles(resolve(repoRoot, "apps/ai-gateway-service/evidence"));
  const evidenceTexts = Object.fromEntries(
    await Promise.all(evidenceFiles.map(async (path) => [toRepoPath(path), await readFile(path, "utf8")])),
  );

  const missingScripts = requiredRootScripts.filter((scriptName) => !rootPackage.scripts?.[scriptName]);
  const healthScript = rootPackage.scripts?.["health:phase12a"] ?? "";
  const healthIsLocalOnly =
    healthScript === "node ./tools/phase12a/health.mjs" &&
    existsSync(resolve(repoRoot, "tools/phase12a/health.mjs"));
  const mojibakeFindings = findMarkers({ ...docTexts, "tools/phase14a/help.mjs": await readText("tools/phase14a/help.mjs") });
  const secretFindings = findSecrets({ ...docTexts, ...evidenceTexts });
  const releaseDoc = docTexts["docs/GLOBAL_RELEASE_READINESS.md"] ?? "";
  const boundaryTextPresent =
    releaseDoc.includes("不是 release automation") &&
    releaseDoc.includes("默认 `/chat` 主链仍是 NVIDIA single-provider") &&
    releaseDoc.includes("API Key、数据库密码、完整连接串不得写入");

  const passed =
    docs.every((doc) => doc.exists && doc.utf8Readable) &&
    missingScripts.length === 0 &&
    healthIsLocalOnly &&
    mojibakeFindings.length === 0 &&
    secretFindings.length === 0 &&
    boundaryTextPresent;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    docs,
    scripts: {
      required: requiredRootScripts,
      missing: missingScripts,
      healthScript,
      healthIsLocalOnly,
    },
    readability: {
      mojibakeMarkerCount: mojibakeFindings.length,
      mojibakeFindings,
    },
    secrets: {
      checkedFiles: requiredDocs.length + evidenceFiles.length,
      findingCount: secretFindings.length,
      findings: secretFindings,
    },
    boundaries: {
      releaseDoc: "docs/GLOBAL_RELEASE_READINESS.md",
      boundaryTextPresent,
      releaseAutomation: false,
      providerCalls: false,
      serviceStart: false,
      runtimeMutation: false,
    },
    conclusion: passed ? "global-release-readiness-baseline-connected" : "global-release-readiness-baseline-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "global-release-readiness-baseline-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function readDocStatus(path) {
  const absolutePath = resolve(repoRoot, path);
  if (!existsSync(absolutePath)) {
    return {
      path,
      exists: false,
      utf8Readable: false,
      bytes: 0,
    };
  }

  const text = await readFile(absolutePath, "utf8");
  return {
    path,
    exists: true,
    utf8Readable: true,
    bytes: Buffer.byteLength(text, "utf8"),
    lineCount: text.split(/\r?\n/).length,
  };
}

async function readText(path) {
  return readFile(resolve(repoRoot, path), "utf8");
}

async function listEvidenceTextFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && [".md", ".json"].includes(extname(entry.name)))
    .map((entry) => join(dir, entry.name));
}

function findMarkers(fileTexts) {
  const findings = [];
  for (const [path, text] of Object.entries(fileTexts)) {
    const markers = mojibakeMarkers.filter((marker) => text.includes(marker));
    if (markers.length > 0) {
      findings.push({ path, markers });
    }
  }
  return findings;
}

function findSecrets(fileTexts) {
  const findings = [];
  for (const [path, text] of Object.entries(fileTexts)) {
    for (const { name, pattern } of secretPatterns) {
      const matches = Array.from(text.matchAll(pattern)).map((match) => maskSecret(match[0]));
      if (matches.length > 0) {
        findings.push({ path, type: name, matches });
      }
    }
  }
  return findings;
}

function maskSecret(value) {
  const text = String(value);
  if (text.length <= 10) {
    return "<redacted>";
  }
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function toRepoPath(path) {
  return path.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 78A Global Release Readiness Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Required docs present: ${(body.docs ?? []).every((doc) => doc.exists)}
- Missing scripts: ${(body.scripts?.missing ?? []).join(", ") || "none"}
- Health local only: ${body.scripts?.healthIsLocalOnly}
- Mojibake findings: ${body.readability?.mojibakeMarkerCount ?? "n/a"}
- Secret findings: ${body.secrets?.findingCount ?? "n/a"}
- Boundary text present: ${body.boundaries?.boundaryTextPresent}
- Release automation performed: ${body.boundaries?.releaseAutomation}
- Provider calls performed: ${body.boundaries?.providerCalls}
- Runtime mutation performed: ${body.boundaries?.runtimeMutation}
- Conclusion: ${body.conclusion}
`;
}
