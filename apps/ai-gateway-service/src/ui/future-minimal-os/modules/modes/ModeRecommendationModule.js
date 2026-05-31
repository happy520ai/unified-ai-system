import { renderModeSelectorCards } from "../../ModeSelectorCards.js";

export function renderModeRecommendationModule({ copy, state }) {
  const recommendedMode = state?.recommendedMode || copy.modeCopy.defaultRecommendedMode;
  return renderModeSelectorCards(copy.modeCopy, recommendedMode);
}
