import { drawerCopy } from "./drawerCopy.js";
import { modeCopy } from "./modeCopy.js";
import { securityCopy } from "./securityCopy.js";

const phase1101LegacyVerifierCompatibility = [
  "AI Gateway",
  "Mission Control",
  "safe-preview-only",
  "Provider CredentialRef",
  "Evidence Replay",
  "Diagnostics"
];

void phase1101LegacyVerifierCompatibility;

export const futureMinimalOsCopy = {
  productName: "PME AI Gateway",
  title: "Mission Control OS",
  eyebrow: "Future Minimal OS",
  subtitle: "把任务先变成安全预案。这里不调用 Provider，不读取密钥，不部署，也不改变默认聊天链路。",
  taskLabel: "今天要让系统帮你处理什么？",
  taskPlaceholder: "例如：帮我检查本轮本地自用方案，列出风险、执行顺序和下一步。",
  primaryCta: "预览执行方案",
  safeMode: "预览模式",
  legacySafeModeLabel: "安全预览模式",
  nextStep: "确认预案后，再进入单独授权的受控流程。",
  legacySafetyPhrases: [
    "不会读取密钥",
    "不会调用真实模型",
    "重要问题",
    "系统建议"
  ],
  commandHint: "先看计划，再决定是否继续。",
  dock: [
    { label: "状态", value: "预览模式" },
    { label: "Provider", value: "不会调用" },
    { label: "Secret", value: "不会读取" },
    { label: "Deploy", value: "不会部署" },
    { label: "Evidence", value: "可查看" }
  ],
  preview: {
    title: "安全预案",
    why: "推荐模式",
    willDo: "我会做什么",
    willNotDoTitle: "我不会做什么",
    next: "下一步",
    waiting: "输入任务后，先生成安全预案。",
    generated: "已生成安全预案，未执行真实任务。",
    defaultWhy: "任务包含多步判断，建议先规划再行动。",
    defaultWillDo: "整理任务、推荐模式、列出边界和下一步。",
    willNotDo: "不会读取密钥，不会调用真实模型，不会部署，不会改变默认聊天链路。"
  },
  previewBlocks: {
    mode: "Tianshu · 复杂任务",
    willDo: "拆解目标、标出风险、生成下一步清单。",
    willNotDo: "不调用 Provider，不读取 secret，不部署。",
    next: "你确认后，再进入授权流程。"
  },
  emptyText: "请先输入一个任务。",
  errorText: "暂时无法生成预案；当前仍停留在安全预览。",
  sample: {
    eyebrow: "Local self-use",
    title: "本地自用入口",
    body: "样例、Owner feedback、issue ledger 和 bug governance 都是本地记录入口，不代表已经对外提供服务。",
    action: "查看本地入口"
  },
  modeCopy,
  securityCopy,
  drawerCopy
};
