export function parseManual(manual) {
  if (!manual) {
    return { goal: "", steps: [] };
  }
  if (typeof manual === "object") {
    return {
      goal: String(manual.goal || manual.name || ""),
      steps: Array.isArray(manual.steps) ? manual.steps : [],
    };
  }

  const text = String(manual);
  const steps = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  return {
    goal: steps[0] || text.trim(),
    steps: steps.map((instruction, index) => ({ index: index + 1, instruction })),
  };
}
