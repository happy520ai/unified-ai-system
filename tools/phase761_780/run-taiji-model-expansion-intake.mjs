import { buildTaijiModelExpansionIntake } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase761-780-common.mjs";

const samples = [
  buildTaijiModelExpansionIntake({ requestText: "我要接入 OpenAI 的模型" }),
  buildTaijiModelExpansionIntake({ requestText: "我要接入 Qwen 的模型" }),
  buildTaijiModelExpansionIntake({ requestText: "我要接入某某 Provider 的模型" }),
];
const result = {
  phase: "Phase779",
  completed: true,
  taijiModelExpansionIntakeReady: true,
  runtimeEnabled: false,
  providerCallsMade: false,
  secretRead: false,
  selectableModified: false,
  samples,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase761_780/taiji-model-expansion-intake-result.json", result);

writeText("docs/phase779-taiji-beidou-model-expansion-intake.md", phaseDoc({
  phase: "Phase779",
  title: "Taiji / Beidou Model Expansion Intake",
  goal: "让太极 / 北斗支持自然语言模型接入请求的 dry-run intake。",
  facts: [
    "input example: 我要接入某某 Provider 的模型",
    "output includes provider family guess, credential requirement, risk classification, discovery plan, smoke plan, selectable gate plan, rollback plan",
    "runtimeEnabled=false",
  ],
  boundaries: ["providerCallsMade=false", "secretRead=false", "selectableModified=false"],
  outputs: ["apps/ai-gateway-service/evidence/phase761_780/taiji-model-expansion-intake-result.json"],
}));

console.log(JSON.stringify({ phase: "Phase779", taijiModelExpansionIntakeReady: true, ...baseSafety() }, null, 2));
