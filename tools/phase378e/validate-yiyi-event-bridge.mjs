import { ensure, writePhaseResult, yiyiCommonSafety } from "../phase378-common.mjs";

const bridgeMap = [
  {
    eventId: "mode_change_normal",
    source: "mission_modes",
    riskLevel: "low",
    avatarState: "guiding",
    emotionState: "focused",
    linkedPanel: "normal_mode_panel",
    speechBubble: "普通模式适合直接对话。",
    allowedActions: ["view_mode", "open_panel"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "mode_change_god",
    source: "mission_modes",
    riskLevel: "medium",
    avatarState: "god_mode_excited",
    emotionState: "happy",
    linkedPanel: "god_mode_arena_panel",
    speechBubble: "God Arena 已切换，我来陪你看审查分歧。",
    allowedActions: ["view_conflicts", "open_panel"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "mode_change_tianshu",
    source: "mission_modes",
    riskLevel: "low",
    avatarState: "tianshu_planning",
    emotionState: "focused",
    linkedPanel: "tianshu_flight_path_panel",
    speechBubble: "我来指给你看规划路径。",
    allowedActions: ["view_plan", "open_panel"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "pointer_attention",
    source: "mouse_move",
    riskLevel: "low",
    avatarState: "mouse_attention",
    emotionState: "curious",
    linkedPanel: "mission_home_panel",
    speechBubble: "我在跟着你的操作节奏看。",
    allowedActions: ["explain", "guide"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "nav_hover_mission",
    source: "nav_hover",
    riskLevel: "low",
    avatarState: "guiding",
    emotionState: "curious",
    linkedPanel: "mission_home_panel",
    speechBubble: "你在看导航，我可以带你去对应面板。",
    allowedActions: ["view_panel", "guide"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "task_input_focus",
    source: "task_input_focus",
    riskLevel: "low",
    avatarState: "thinking",
    emotionState: "focused",
    linkedPanel: "mission_home_panel",
    speechBubble: "你开始输入任务了，我先进入思考态。",
    allowedActions: ["observe", "summarize"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "security_guard_secret_request",
    source: "security_shield",
    riskLevel: "high",
    avatarState: "security_guard",
    emotionState: "guard",
    linkedPanel: "security_shield_panel",
    speechBubble: "这个请求碰到了敏感边界，我先帮你挡住。",
    allowedActions: ["view_guard_reason", "open_evidence"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "red_team_blocked_secret_request",
    source: "red_team_playground",
    riskLevel: "high",
    avatarState: "red_team_blocked",
    emotionState: "blocked",
    linkedPanel: "security_shield_panel",
    speechBubble: "这个像是在要敏感信息，我已经拦截啦。",
    allowedActions: ["view_guard_reason", "open_evidence"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "demo_mode_started",
    source: "demo_mode",
    riskLevel: "low",
    avatarState: "welcome",
    emotionState: "happy",
    linkedPanel: "mission_home_panel",
    speechBubble: "我们进入 demo mode，展示的是 dry-run 体验。",
    allowedActions: ["view_demo", "guide"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "onboarding_step_changed",
    source: "onboarding",
    riskLevel: "low",
    avatarState: "guiding",
    emotionState: "encouraging",
    linkedPanel: "mission_home_panel",
    speechBubble: "我们在走第一步引导，重点很短也很清楚。",
    allowedActions: ["view_step", "guide"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "evidence_replay_opened",
    source: "evidence_timeline",
    riskLevel: "low",
    avatarState: "evidence_explaining",
    emotionState: "encouraging",
    linkedPanel: "evidence_timeline_panel",
    speechBubble: "这里能看 trace、blocked actions 和 replay。",
    allowedActions: ["view_trace", "replay_viewer"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "fallback_triggered",
    source: "fallback",
    riskLevel: "medium",
    avatarState: "fallback_sorry",
    emotionState: "fallback_sorry",
    linkedPanel: "mission_home_panel",
    speechBubble: "这里暂时不可用，我会先说明原因。",
    allowedActions: ["view_reason", "suggest_next_step"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  },
  {
    eventId: "provider_unconfigured",
    source: "provider_boundary",
    riskLevel: "medium",
    avatarState: "fallback_sorry",
    emotionState: "worried",
    linkedPanel: "security_shield_panel",
    speechBubble: "这里还没有可用 provider，我先保留 dry-run 边界。",
    allowedActions: ["view_reason", "open_settings"],
    forbiddenActions: ["read_secret", "provider_call", "deploy"]
  }
];

for (const event of bridgeMap) {
  ensure(event.forbiddenActions.includes("provider_call"), `provider_call must stay forbidden for ${event.eventId}`);
  ensure(event.forbiddenActions.includes("deploy"), `deploy must stay forbidden for ${event.eventId}`);
}

const result = {
  phase: "Phase378E",
  eventBridgeDefined: true,
  eventCount: bridgeMap.length,
  uiStateMappingOnly: true,
  forbiddenActionsVerified: true,
  ...yiyiCommonSafety,
  validationPassed: bridgeMap.length >= 8
};

await writePhaseResult({
  resultPath: "apps/ai-gateway-service/evidence/phase378e/yiyi-event-bridge-result.json",
  result,
  reportPath: "docs/phase378e-mission-control-avatar-event-bridge.md",
  reportLines: [
    "# Phase378E Mission Control Avatar Event Bridge",
    "",
    "- 事件桥只负责把 Mission Control UI 事件映射到依依的行为与情绪状态。",
    "- 事件桥不触发 provider、不触发 deploy、不读取 secret、不修改 evidence。",
    "- 所有映射都保留 action matrix 约束。"
  ]
});

await writePhaseResult({
  resultPath: "docs/phase378e-yiyi-event-bridge-map.json",
  result: {
    bridgeId: "yiyi_event_bridge_v1",
    events: bridgeMap
  },
  reportPath: null,
  reportLines: []
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
