export const WORKFORCE_PYRAMID_LEVELS = Object.freeze([
  { id: "L0", title: "System Governor", defaultMaxActive: 1 },
  { id: "L1", title: "Executive Council", defaultMaxActive: 1 },
  { id: "L2", title: "Domain Chiefs", defaultMaxActive: 2 },
  { id: "L3", title: "Principal Experts", defaultMaxActive: 3 },
  { id: "L4", title: "Senior Specialists", defaultMaxActive: 3 },
  { id: "L5", title: "Operators", defaultMaxActive: 3 },
  { id: "L6", title: "Assistants", defaultMaxActive: 3 },
]);

export function isValidPyramidLevel(levelId) {
  return WORKFORCE_PYRAMID_LEVELS.some((level) => level.id === levelId);
}
