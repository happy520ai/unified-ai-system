import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const defaultEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const defaultJsonlPath = resolve(defaultEvidenceDir, "phase-312a-chat-gateway-evidence.jsonl");
const defaultLatestPath = resolve(defaultEvidenceDir, "phase-312a-chat-gateway-latest.json");
const phase314aJsonlPath = resolve(defaultEvidenceDir, "phase-314a-chat-gateway-evidence.jsonl");
const phase314aLatestPath = resolve(defaultEvidenceDir, "phase-314a-chat-gateway-latest.json");

let evidenceCounter = 0;

export function generateEvidenceId() {
  evidenceCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `phase-314a-${ts}-${rand}`;
}

export async function recordChatGatewayEvidence(record = {}, { jsonlPath = defaultJsonlPath, latestPath = defaultLatestPath } = {}) {
  const evidenceId = record.evidenceId ?? generateEvidenceId();
  const sanitized = sanitizeEvidence({
    recordedAt: new Date().toISOString(),
    phase: "Phase314A",
    evidenceId,
    ...record,
  });
  await mkdir(dirname(jsonlPath), { recursive: true });
  await appendFile(jsonlPath, `${JSON.stringify(sanitized)}\n`, "utf8");
  await writeFile(latestPath, JSON.stringify(sanitized, null, 2), "utf8");

  await mkdir(dirname(phase314aJsonlPath), { recursive: true });
  await appendFile(phase314aJsonlPath, `${JSON.stringify(sanitized)}\n`, "utf8");
  await writeFile(phase314aLatestPath, JSON.stringify(sanitized, null, 2), "utf8");

  return {
    jsonlPath,
    latestPath,
    phase314aJsonlPath,
    phase314aLatestPath,
    evidenceId,
    record: sanitized,
  };
}

export async function getEvidenceById(evidenceId) {
  const { readFile } = await import("node:fs/promises");
  try {
    const content = await readFile(phase314aJsonlPath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.evidenceId === evidenceId) return record;
      } catch {}
    }
  } catch {}
  return null;
}

export function sanitizeEvidence(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidence(item));
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, nextValue] of Object.entries(value)) {
      if (/api[_-]?key|secret|token|authorization|bearer/i.test(key)) {
        output[key] = "[redacted]";
        continue;
      }
      output[key] = sanitizeEvidence(nextValue);
    }
    return output;
  }

  if (typeof value === "string") {
    return redactSecrets(value);
  }

  return value;
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}