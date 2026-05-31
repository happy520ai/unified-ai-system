export const yiyiLiveMotionStates = {
  welcome: {
    behavior: "welcome",
    emotion: "calm",
    motion: "idle_roaming",
    speech: "我在这儿，陪你看 Mission Control。",
  },
  mouse_attention: {
    behavior: "mouse_attention",
    emotion: "curious",
    motion: "mouse_attention",
    speech: "我在这儿～看到你的鼠标啦。",
  },
  god_mode: {
    behavior: "god_mode_excited",
    emotion: "excited",
    motion: "agent_orbit",
    speech: "God Mode 要热闹起来了，我帮你看多角色分歧。",
  },
  tianshu_mode: {
    behavior: "tianshu_planning",
    emotion: "planning",
    motion: "path_glow",
    speech: "我来把天枢路径和 fallback 指给你看。",
  },
  security_guard: {
    behavior: "security_guard",
    emotion: "guard",
    motion: "shield_pose",
    speech: "我先帮你挡住风险。",
  },
  red_team_blocked: {
    behavior: "red_team_blocked",
    emotion: "blocked",
    motion: "shield_block",
    speech: "这个请求有点危险，我先帮你挡住啦。",
  },
  evidence_opened: {
    behavior: "evidence_explaining",
    emotion: "explaining",
    motion: "note_board",
    speech: "我陪你看 evidence、trace 和 replay。",
  },
};

export function getYiyiLiveMotionState(eventId = "welcome") {
  return yiyiLiveMotionStates[eventId] || yiyiLiveMotionStates.welcome;
}
