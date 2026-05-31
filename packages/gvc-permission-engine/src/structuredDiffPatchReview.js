export function buildPatchPreview({ filePath, beforeText = "", afterText = "", riskLevel = "L1" } = {}) {
  const normalizedPath = String(filePath || "").replaceAll("\\", "/");
  const beforeLines = String(beforeText).split(/\r?\n/);
  const afterLines = String(afterText).split(/\r?\n/);
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  const lines = [];
  for (let index = 0; index < maxLength; index += 1) {
    if (beforeLines[index] === afterLines[index]) continue;
    if (beforeLines[index] !== undefined) lines.push({ type: "remove", line: index + 1, text: beforeLines[index] });
    if (afterLines[index] !== undefined) lines.push({ type: "add", line: index + 1, text: afterLines[index] });
  }
  const riskFlags = buildRiskFlags(normalizedPath, riskLevel);
  return {
    filePath: normalizedPath,
    riskLevel,
    patchPreview: { lines },
    riskFlags,
    recommendedAction: riskFlags.includes("high_risk") || riskFlags.includes("chat_route") ? "approval_required" : "can_execute_after_review",
    mutationEvidenceRequired: true,
    realWritePerformed: false,
    providerCallsMade: false,
    secretRead: false,
  };
}

function buildRiskFlags(filePath, riskLevel) {
  const flags = [];
  if (String(riskLevel).toUpperCase() === "L3") flags.push("high_risk");
  if (/\/chat|chat-gateway\/execute|src\/chat-gateway/.test(filePath)) flags.push("chat_route");
  if (/legacy\//.test(filePath)) flags.push("legacy");
  if (/project_context\.md/i.test(filePath)) flags.push("project_context");
  return flags;
}
