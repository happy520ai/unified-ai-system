export function classifyEmployeeRisk(position) {
  const text = [
    position?.canonicalTitle,
    position?.industryDomain,
    ...(position?.skillTags || []),
    ...(position?.taskTags || []),
  ].join(" ").toLowerCase();
  if (/security|legal|medical|compliance|finance/.test(text)) return "high";
  if (/operations|manufacturing|infrastructure|support/.test(text)) return "medium";
  return "low";
}

