import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function writeThreeModeAuditLog({ telemetryItems = [], filePath = resolve("apps/ai-gateway-service/evidence/phase329a/three-mode-audit-log.json") } = {}) {
  const payload = {
    phase: "Phase329A",
    logType: "three-mode-audit-log",
    secretValueExposed: false,
    generatedAt: new Date().toISOString(),
    telemetryItems,
  };
  await mkdir(resolve(filePath, ".."), { recursive: true }).catch(() => {});
  await mkdir(resolve("apps/ai-gateway-service/evidence/phase329a"), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}
