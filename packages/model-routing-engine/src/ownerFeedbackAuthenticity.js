function nonEmptyArray(value) {
  return Array.isArray(value) && value.some((item) => String(item ?? "").trim().length > 0);
}

export function checkOwnerFeedbackAuthenticity(input = null) {
  const missing = [];
  if (!input || typeof input !== "object") {
    return {
      ownerFeedbackCollected: false,
      ownerFeedbackAuthentic: false,
      blocker: "owner_real_manual_feedback_missing",
      missing: ["owner-feedback.input.json"]
    };
  }

  if (input.feedbackSource !== "owner") missing.push("feedbackSource=owner");
  if (String(input.ownerName || "").trim() === "") missing.push("ownerName");
  if (input.isRealManualTrial !== true) missing.push("isRealManualTrial=true");
  if (String(input.trialDate || "").trim() === "") missing.push("trialDate");
  if (!(Number(input.trialDurationMinutes) > 0)) missing.push("trialDurationMinutes>0");
  if (!nonEmptyArray(input.walkedPaths)) missing.push("walkedPaths");
  if (!nonEmptyArray(input.tasksTried)) missing.push("tasksTried");

  const hasFeedbackBody = [
    input.whatWorked,
    input.whatFailed,
    input.confusingPoints,
    input.bugsObserved
  ].some(nonEmptyArray);
  if (!hasFeedbackBody) missing.push("one feedback body array");

  const evidenceRefsEmpty = !nonEmptyArray(input.evidenceRefs);
  if (evidenceRefsEmpty && String(input.noEvidenceReason || "").trim() === "") {
    missing.push("noEvidenceReason when evidenceRefs empty");
  }

  return {
    ownerFeedbackCollected: missing.length === 0,
    ownerFeedbackAuthentic: missing.length === 0,
    blocker: missing.length === 0 ? null : "owner_real_manual_feedback_missing",
    missing,
    codexSelfTestCountedAsOwnerFeedback: false,
    externalTesterFeedbackCount: 0
  };
}
