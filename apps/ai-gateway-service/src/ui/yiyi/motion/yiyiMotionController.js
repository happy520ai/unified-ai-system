import { getYiyiLiveMotionState } from "./yiyiMotionState.js";

export function applyYiyiLiveMotionState(currentState = {}, eventId = "welcome") {
  return {
    ...currentState,
    ...getYiyiLiveMotionState(eventId),
  };
}
