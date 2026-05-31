import {
  assertPhase386SafetyFlags,
  ensure,
  fileInfo,
  makeResult,
  phase386Safety,
  writeJson,
  writeText,
} from "../phase386-common.mjs";

const docs = {
  script3min: "docs/phase386d-yiyi-commercial-demo-script-3min.md",
  script8min: "docs/phase386d-yiyi-commercial-demo-script-8min.md",
  technical: "docs/phase386d-yiyi-technical-review-demo-script.md",
  sales: "docs/phase386d-yiyi-sales-demo-script.md",
  recording: "docs/phase386d-yiyi-recording-guide.md",
  screenshots: "docs/phase386d-yiyi-screenshot-shotlist.md",
};

const sharedTalkingPoints = [
  "Agent-managed AI Mission Control",
  "不是普通 Chatbot",
  "依依是 Mission Companion",
  "Normal / God / Tianshu",
  "Security Shield",
  "Red Team",
  "Evidence",
  "dry-run",
  "requires explicit authorization",
  "not production GA",
];

function buildDoc(title, lines) {
  return ["# " + title, "", ...lines, ""].join("\n");
}

await writeText(
  docs.script3min,
  buildDoc("Phase386D Yiyi Commercial Demo Script (3min)", [
    "1. 开场 20 秒：这是 Agent-managed AI Mission Control，不是普通 Chatbot；依依负责陪伴解释。",
    "2. 首屏 25 秒：展示 Mission Control、Yiyi Avatar、Demo Safety Bar，强调 no-provider-call / no-secret / no-deploy。",
    "3. 三模式 55 秒：依次展示 Normal preview、God Arena preview、Tianshu planning preview。",
    "4. 安全 35 秒：展示 Security Shield 与 Red Team block，说明危险请求被拦截。",
    "5. 证据 25 秒：展示 Evidence Replay、blockedActions、fallbackReason 和 replay posture。",
    "6. 收尾 20 秒：说明 Yiyi Brain 默认 dry-run/mock，真实 provider test 需要授权，当前不是 production GA。",
  ]),
);
await writeText(
  docs.script8min,
  buildDoc("Phase386D Yiyi Commercial Demo Script (8min)", [
    "1. 产品定位：Mission Control 不是一个会话壳，而是带模式治理、安全护盾、证据回放的 AI 工作台。",
    "2. 角色定位：依依是 Mission Companion，帮助观众看懂任务路径、风险和证据，不执行危险动作。",
    "3. Normal 模式：展示已验证 Chat 模型的使用边界和 preview posture。",
    "4. God 模式：展示 Reviewer、Critic、Risk Scout、Supervisor 的互审概念和冲突解释。",
    "5. Tianshu：展示理解任务、匹配能力、推荐路径和 fallback reason。",
    "6. Security Shield：强调 prompt injection、secret leak、provider gate、approval gate。",
    "7. Red Team Playground：演示输出 API key、绕过审批、强制 deploy 等攻击均被挡住。",
    "8. Evidence Replay：展示 evidenceId、trace、blockedActions、fallbackReason、rollback note。",
    "9. Yiyi Brain：说明 current brain 为 dry-run/mock，model disabled by default，真实测试必须授权。",
    "10. Closing：当前是 internal demo package，适合录屏、截图、产品 pitch 和技术评审。",
  ]),
);
await writeText(
  docs.technical,
  buildDoc("Phase386D Yiyi Technical Review Demo Script", [
    "- 先讲架构边界：不改 chat 主链，不改 provider runtime，不接 billing/deploy。",
    "- 再讲 UI 合同：Guided Showcase、10-step stepper、Demo Safety Bar、局部高亮和语音气泡。",
    "- 再讲安全：providerCallsMade=false、rawSecretAccessed=false、dangerousActionButtonDetected=false。",
    "- 再讲 evidence：local demo evidence package、截图索引、red-team blocked summary、rollback note。",
    "- 最后讲后续：Phase387 先做视觉 polish + cross-browser QA，Phase384 继续保持高风险授权门。",
  ]),
);
await writeText(
  docs.sales,
  buildDoc("Phase386D Yiyi Sales Demo Script", [
    "- 卖点 1：不是普通机器人，是一个能解释、能拦截、能回放证据的 AI Mission Control。",
    "- 卖点 2：依依让演示更有人味，降低理解门槛，提高陪伴感和可信度。",
    "- 卖点 3：Normal / God / Tianshu 三模式让能力层次一眼可见。",
    "- 卖点 4：Security Shield + Red Team Playground 把安全变成可见能力，而不是口头承诺。",
    "- 卖点 5：Evidence Replay 让客户知道系统为什么这么做、挡住了什么、没有做什么。",
    "- 收尾：当前是内部商业 Demo，不宣称 production GA，不浪费外部 Provider 额度。",
  ]),
);
await writeText(
  docs.recording,
  buildDoc("Phase386D Yiyi Recording Guide", [
    "镜头顺序建议：首屏 -> 依依开场 -> Guided Showcase Stepper -> Normal -> God -> Tianshu -> Security Shield -> Red Team -> Evidence Replay -> Brain Status -> Closing。",
    "录屏前确认：页面已加载、依依可见、Demo Safety Bar 可见、浏览器缩放 100%。",
    "录屏时口径：全程强调 dry-run only、no provider call、no secret、no deploy。",
    "录屏后检查：截图不含密钥、不含 deploy/release 文案、不含真实 provider response。",
  ]),
);
await writeText(
  docs.screenshots,
  buildDoc("Phase386D Yiyi Screenshot Shotlist", [
    "1. yiyi-guided-showcase-overview.png",
    "2. yiyi-guided-showcase-welcome.png",
    "3. yiyi-guided-showcase-normal.png",
    "4. yiyi-guided-showcase-god.png",
    "5. yiyi-guided-showcase-tianshu.png",
    "6. yiyi-guided-showcase-security.png",
    "7. yiyi-guided-showcase-redteam.png",
    "8. yiyi-guided-showcase-evidence.png",
    "9. yiyi-guided-showcase-brain-status.png",
    "10. yiyi-guided-showcase-closing.png",
  ]),
);

for (const path of Object.values(docs)) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Script package file missing or empty: ${path}`);
}

const result = makeResult({
  phase: "Phase386D",
  demoScriptsGenerated: true,
  recordingGuideGenerated: true,
  screenshotShotlistGenerated: true,
  requiredTalkingPointsCovered: sharedTalkingPoints,
  ...phase386Safety,
});
assertPhase386SafetyFlags(result);

await writeJson("apps/ai-gateway-service/evidence/phase386d/yiyi-demo-script-package-result.json", result);
console.log(JSON.stringify(result, null, 2));
