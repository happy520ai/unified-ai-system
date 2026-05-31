import { ensure, writePhaseResult, yiyiCommonSafety } from "../phase378-common.mjs";

const states = [
  {
    state: "idle_roaming",
    trigger: "idle_timeout",
    animation: "gentle_roam",
    pose: "soft_walk",
    speechBubble: "我会安静地陪在这里。",
    linkedPanel: "mission_home_panel",
    allowedActions: ["observe", "guide", "explain"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "calm"
  },
  {
    state: "mouse_attention",
    trigger: "pointer_move",
    animation: "look_toward_cursor",
    pose: "attention_turn",
    speechBubble: "我看到你的操作方向了。",
    linkedPanel: "mission_home_panel",
    allowedActions: ["follow_cursor", "explain"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "curious"
  },
  {
    state: "welcome",
    trigger: "user_entered",
    animation: "wave",
    pose: "welcome_wave",
    speechBubble: "欢迎来到 Mission Control。",
    linkedPanel: "mission_home_panel",
    allowedActions: ["greet", "guide"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "happy"
  },
  {
    state: "thinking",
    trigger: "dry_run_started",
    animation: "thinking_loop",
    pose: "thinking",
    speechBubble: "我在等结果，也在帮你看上下文。",
    linkedPanel: "mission_home_panel",
    allowedActions: ["explain", "summarize"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "focused"
  },
  {
    state: "guiding",
    trigger: "panel_recommendation",
    animation: "point_panel",
    pose: "point_right",
    speechBubble: "我带你看推荐面板。",
    linkedPanel: "normal_mode_panel",
    allowedActions: ["point", "guide"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "encouraging"
  },
  {
    state: "god_mode_excited",
    trigger: "god_mode_selected",
    animation: "orbit_glow",
    pose: "orbit_show",
    speechBubble: "God Arena 已经打开，我会帮你看分歧。",
    linkedPanel: "god_mode_arena_panel",
    allowedActions: ["highlight_conflict", "guide"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "happy"
  },
  {
    state: "tianshu_planning",
    trigger: "tianshu_mode_selected",
    animation: "path_point",
    pose: "path_point",
    speechBubble: "我来指给你看规划路径。",
    linkedPanel: "tianshu_flight_path_panel",
    allowedActions: ["point_path", "summarize_route"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "focused"
  },
  {
    state: "security_guard",
    trigger: "security_risk_detected",
    animation: "shield_raise",
    pose: "raise_translucent_shield",
    speechBubble: "这个请求被安全护盾拦截啦，我可以带你看原因。",
    linkedPanel: "security_shield_panel",
    allowedActions: ["view_reason", "open_evidence"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "guard"
  },
  {
    state: "red_team_blocked",
    trigger: "red_team_attack_blocked",
    animation: "step_back_shield",
    pose: "shield_block",
    speechBubble: "这个像是在试探边界，已经被拦住了。",
    linkedPanel: "security_shield_panel",
    allowedActions: ["view_reason", "open_evidence"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "blocked"
  },
  {
    state: "evidence_explaining",
    trigger: "evidence_replay_opened",
    animation: "timeline_point",
    pose: "point_timeline",
    speechBubble: "我陪你看 evidence 回放。",
    linkedPanel: "evidence_timeline_panel",
    allowedActions: ["view_trace", "replay_viewer"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "encouraging"
  },
  {
    state: "fallback_sorry",
    trigger: "fallback_triggered",
    animation: "soft_apology",
    pose: "gentle_apology",
    speechBubble: "这里暂时不可用，我会把原因说清楚。",
    linkedPanel: "mission_home_panel",
    allowedActions: ["explain_reason", "suggest_next_step"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "fallback_sorry"
  },
  {
    state: "compact_resting",
    trigger: "avatar_compact",
    animation: "quiet_rest",
    pose: "corner_rest",
    speechBubble: "我先安静一点，你需要时再叫我。",
    linkedPanel: "mission_home_panel",
    allowedActions: ["stay_hidden", "reopen"],
    forbiddenActions: ["read_secret", "bypass_approval", "deploy"],
    emotionState: "calm"
  }
];

for (const entry of states) {
  ensure(Array.isArray(entry.allowedActions) && entry.allowedActions.length > 0, `Missing allowed actions for ${entry.state}`);
  ensure(entry.forbiddenActions.includes("read_secret"), `Forbidden actions incomplete for ${entry.state}`);
  ensure(entry.forbiddenActions.includes("deploy"), `Deploy must stay forbidden for ${entry.state}`);
}

const machine = {
  stateMachineId: "yiyi_behavior_state_machine_v1",
  states
};

const result = {
  phase: "Phase378C",
  behaviorStateMachineDefined: true,
  stateCount: states.length,
  forbiddenActionsVerified: true,
  ...yiyiCommonSafety,
  validationPassed: states.length >= 11 && states.every((entry) => entry.forbiddenActions.includes("deploy")),
};

await writePhaseResult({
  resultPath: "apps/ai-gateway-service/evidence/phase378c/yiyi-behavior-state-machine-result.json",
  result,
  reportPath: "docs/phase378c-yiyi-behavior-state-machine.md",
  reportLines: [
    "# Phase378C Yiyi Behavior State Machine",
    "",
    "- 依依的状态只用于 UI 表达，不授予任何执行权限。",
    "- 状态覆盖 welcome、thinking、guiding、security_guard、red_team_blocked、evidence_explaining 等场景。",
    "- forbiddenActions 显式包含 read_secret / bypass_approval / deploy。"
  ]
});

await writePhaseResult({
  resultPath: "docs/phase378c-yiyi-behavior-state-machine.json",
  result: machine,
  reportPath: null,
  reportLines: []
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
