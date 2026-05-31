export const workforcePyramidLevelPolicy = Object.freeze([
  { level: "L0", name: "System Governor", maxInstances: 1, defaultSeniority: "governor" },
  { level: "L1", name: "Executive Council", maxInstances: 5, defaultSeniority: "executive" },
  { level: "L2", name: "Domain Chiefs", maxInstances: 12, defaultSeniority: "principal" },
  { level: "L3", name: "Principal Experts", maxInstances: 40, defaultSeniority: "principal" },
  { level: "L4", name: "Senior Specialists", maxInstances: 120, defaultSeniority: "senior" },
  { level: "L5", name: "Operators", maxInstances: 300, defaultSeniority: "operator" },
  { level: "L6", name: "Assistants", maxInstances: 600, defaultSeniority: "assistant" },
]);

export function mapPositionToPyramidLevel(position) {
  const title = String(position?.canonicalTitle || position?.sourceTitle || "").toLowerCase();
  if (/chief|executive|governor/.test(title)) return "L1";
  if (/manager|director|architect|counsel|advisor|officer/.test(title)) return "L2";
  if (/scientist|engineer|strategist|researcher|analyst/.test(title)) return "L3";
  if (/specialist|teacher|writer|representative|supervisor/.test(title)) return "L4";
  if (/technician|clerk|driver|machinist/.test(title)) return "L5";
  if (/assistant/.test(title)) return "L6";
  return "L4";
}

