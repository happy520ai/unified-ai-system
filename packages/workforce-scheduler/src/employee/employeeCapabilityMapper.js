export function mapPositionCapabilities(position) {
  return [...new Set([
    ...(position?.skillTags || []),
    ...(position?.knowledgeTags || []),
    ...(position?.taskTags || []),
  ])].slice(0, 8);
}

export function mapAllowedTaskTypes(position) {
  const tags = mapPositionCapabilities(position).join(" ").toLowerCase();
  const taskTypes = [];
  if (/security|secret|risk|compliance|legal/.test(tags)) taskTypes.push("risk_review");
  if (/ux|feedback|product|roadmap|market/.test(tags)) taskTypes.push("ux_refinement_plan");
  if (/architecture|systems|gateway|software|network/.test(tags)) taskTypes.push("architecture_review");
  if (/test|quality|verify|regression/.test(tags)) taskTypes.push("test_plan");
  if (/budget|finance|cost/.test(tags)) taskTypes.push("cost_review");
  return taskTypes.length ? taskTypes : ["general_review"];
}

