import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function createUsageTelemetryStore({ stateFile = resolve("apps/ai-gateway-service/evidence/phase328f/usage-telemetry-store.json") } = {}) {
  return {
    async getSnapshot(userId = "anonymous") {
      const state = await readState(stateFile);
      const entries = (state.entries || []).filter((item) => item.userId === userId);
      const dailyRequestCount = entries.length;
      const monthlyRequestCount = entries.length;
      const dailyEstimatedCost = round(entries.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0));
      const monthlyEstimatedCost = dailyEstimatedCost;
      return {
        userId,
        entries,
        dailyRequestCount,
        monthlyRequestCount,
        dailyEstimatedCost,
        monthlyEstimatedCost,
      };
    },
    async recordUsage(entry) {
      const state = await readState(stateFile);
      state.entries.push({ ...entry, recordedAt: new Date().toISOString() });
      await mkdir(resolve(stateFile, ".."), { recursive: true }).catch(() => {});
      await mkdir(resolve("apps/ai-gateway-service/evidence/phase328f"), { recursive: true });
      await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      return state;
    },
  };
}

async function readState(stateFile) {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    return { phase: "Phase328F", entries: [] };
  }
}

function round(value) {
  return Math.round(Number(value || 0) * 100000) / 100000;
}
