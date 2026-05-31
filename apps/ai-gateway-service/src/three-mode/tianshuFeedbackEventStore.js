import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function createTianshuFeedbackEventStore({ filePath = resolve("apps/ai-gateway-service/evidence/phase330c/tianshu-feedback-events.json") } = {}) {
  return {
    async read() {
      try {
        return JSON.parse(await readFile(filePath, "utf8"));
      } catch {
        return { phase: "Phase330C", events: [] };
      }
    },
    async append(event) {
      const state = await this.read();
      state.events.push({ ...event, storedAt: new Date().toISOString() });
      await mkdir(resolve("apps/ai-gateway-service/evidence/phase330c"), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      return state;
    },
  };
}
