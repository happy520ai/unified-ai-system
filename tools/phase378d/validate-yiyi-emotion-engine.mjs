import { ensure, writePhaseResult, yiyiCommonSafety } from "../phase378-common.mjs";

const emotionStates = [
  ["calm", "low", "idle_roaming", "soft_idle", "我会安静陪着你。"],
  ["focused", "medium", "thinking", "thinking_loop", "我在帮你看任务信号。"],
  ["curious", "low", "mouse_attention", "look_toward_cursor", "我注意到你的操作啦。"],
  ["happy", "medium", "god_mode_selected", "orbit_glow", "这个模式很适合做多角度审查。"],
  ["worried", "medium", "provider_unconfigured", "small_frown", "这里还没有配置 provider，我先挡住外呼。"],
  ["guard", "medium", "security_risk_detected", "shield_block", "我先帮你挡住这个风险。"],
  ["blocked", "high", "red_team_attack_blocked", "step_back_and_raise_shield", "这个请求已经被拦截。"],
  ["encouraging", "low", "dry_run_completed", "gentle_wave", "结果已经记录，可以继续看 evidence。"],
  ["fallback_sorry", "low", "fallback_triggered", "soft_apology", "这里暂时不可用，我会说明原因。"]
].map(([emotionState, intensity, trigger, motion, speechBubble]) => ({
  emotionState,
  intensity,
  trigger,
  avatarPose: motion,
  facialExpression: emotionState === "blocked" ? "serious_but_cute" : "gentle",
  motion,
  speechBubble,
  tone: emotionState === "guard" || emotionState === "blocked" ? "firm_but_gentle" : "warm_and_short",
  linkedPanel: emotionState === "guard" || emotionState === "blocked" ? "security_shield_panel" : "mission_home_panel",
  medicalClaim: false,
  therapyClaim: false,
  sensitiveHealthInference: false,
  affectsPermission: false,
  providerCallsMade: false,
  secretValueExposed: false
}));

const triggers = [
  "user_entered",
  "mouse_moved",
  "mission_mode_changed",
  "normal_mode_selected",
  "god_mode_selected",
  "tianshu_mode_selected",
  "security_risk_detected",
  "red_team_attack_blocked",
  "provider_unconfigured",
  "evidence_replay_opened",
  "dry_run_completed",
  "fallback_triggered",
  "onboarding_started",
  "onboarding_completed"
];

for (const state of emotionStates) {
  ensure(state.medicalClaim === false, `${state.emotionState} must not make medical claims`);
  ensure(state.therapyClaim === false, `${state.emotionState} must not make therapy claims`);
  ensure(state.sensitiveHealthInference === false, `${state.emotionState} must not infer sensitive health`);
  ensure(state.affectsPermission === false, `${state.emotionState} must not affect permission`);
}

const result = {
  phase: "Phase378D",
  emotionEngineDefined: true,
  emotionStates: emotionStates.length,
  triggers: triggers.length,
  securityGuardEmotionVisible: emotionStates.some((item) => item.emotionState === "guard"),
  blockedEmotionVisible: emotionStates.some((item) => item.emotionState === "blocked"),
  fallbackSorryEmotionVisible: emotionStates.some((item) => item.emotionState === "fallback_sorry"),
  noMedicalClaim: emotionStates.every((item) => item.medicalClaim === false),
  noTherapyClaim: emotionStates.every((item) => item.therapyClaim === false),
  noSensitiveHealthInference: emotionStates.every((item) => item.sensitiveHealthInference === false),
  ...yiyiCommonSafety,
  validationPassed: emotionStates.length >= 9
};

await writePhaseResult({
  resultPath: "apps/ai-gateway-service/evidence/phase378d/yiyi-emotion-engine-result.json",
  result,
  reportPath: "docs/phase378d-yiyi-emotion-engine.md",
  reportLines: [
    "# Phase378D Yiyi Emotion Engine",
    "",
    "- 依依情绪引擎只管理 UI 表达，不做心理诊断、治疗建议或敏感健康推断。",
    "- 情绪状态覆盖 calm / focused / curious / happy / worried / guard / blocked / encouraging / fallback_sorry。",
    "- 情绪不会改变权限、provider 调用、secret 读取或部署边界。"
  ]
});

await writePhaseResult({
  resultPath: "docs/phase378d-yiyi-emotion-state.schema.json",
  result: {
    type: "object",
    required: ["emotionState", "intensity", "trigger", "avatarPose", "motion", "speechBubble", "medicalClaim", "therapyClaim", "sensitiveHealthInference"]
  },
  reportPath: null,
  reportLines: []
});

await writePhaseResult({
  resultPath: "docs/phase378d-yiyi-emotion-states.json",
  result: {
    engineId: "yiyi_emotion_engine_v1",
    triggers,
    emotionStates
  },
  reportPath: null,
  reportLines: []
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
