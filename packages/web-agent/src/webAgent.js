import { createBrowserExecutor } from "./browserExecutor.js";
import { createLlmBrain } from "./llmBrain.js";
import { parseManual } from "./manualParser.js";
import { recognizeModules } from "./moduleRecognizer.js";

export function createWebAgent(options = {}) {
  return {
    async run(input = {}) {
      const manual = parseManual(input.manual || input.goal || "");
      const browser = options.browser;
      if (!browser) {
        throw new Error("browser is required");
      }

      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const trace = [];
      const extracted = [];
      let stepsCompleted = 0;

      try {
        if (input.startUrl) {
          await page.goto(input.startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          trace.push({ type: "goto", url: page.url() });
        }

        const snapshot = await recognizeModules(page, { maxModules: options.limits?.maxModules ?? 200 });
        const brain = createLlmBrain({ generate: options.generate });
        const executor = createBrowserExecutor(page);
        const maxSteps = Math.min(manual.steps.length || 1, options.limits?.maxSteps ?? 5);

        for (let index = 0; index < maxSteps; index += 1) {
          const step = manual.steps[index] || { instruction: manual.goal || "extract page text" };
          const action = await brain.decide({ goal: manual.goal, step, snapshot });
          const result = await executor.execute(action);
          trace.push({ step: index + 1, action, result: summarizeResult(result) });
          if (result.text) extracted.push({ step: index + 1, mid: null, text: result.text });
          stepsCompleted += 1;
        }

        return {
          success: true,
          stepsCompleted,
          stepsTotal: maxSteps,
          actionsTotal: trace.length,
          extracted,
          trace,
        };
      } finally {
        await context.close().catch(() => {});
      }
    },
  };
}

function summarizeResult(result) {
  if (!result || !result.text) return result;
  return { ...result, text: result.text.slice(0, 500) };
}
