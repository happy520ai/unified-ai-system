import { WORKFORCE_PYRAMID_LEVELS } from "../../workforce-contracts/src/index.js";

export const workforcePyramid = Object.freeze(WORKFORCE_PYRAMID_LEVELS);

export function getPyramidLevel(levelId) {
  return workforcePyramid.find((level) => level.id === levelId) || null;
}
