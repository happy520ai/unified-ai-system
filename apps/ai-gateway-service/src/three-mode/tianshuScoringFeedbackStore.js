import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function createTianshuScoringFeedbackStore({ filePath = resolve("apps/ai-gateway-service/evidence/phase329c/tianshu-scoring-feedback-store.json") } = {}) {
  return {
    async read() {
      try {
        return JSON.parse(await readFile(filePath, "utf8"));
      } catch {
        return { phase: "Phase329C", feedback: [] };
      }
    },
    async append(feedback) {
      const state = await this.read();
      state.feedback.push({ ...feedback, recordedAt: new Date().toISOString() });
      await mkdir(resolve("apps/ai-gateway-service/evidence/phase329c"), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      return state;
    },
  };
}
