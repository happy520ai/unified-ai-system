export function createLlmBrain(options = {}) {
  const generate = options.generate || (async () => ({ message: { content: "" } }));

  return {
    async decide(input) {
      const response = await generate({
        messages: [
          { role: "system", content: "Return one conservative browser action as JSON." },
          { role: "user", content: JSON.stringify(input) },
        ],
      });
      return parseDecision(response?.message?.content || response?.content || "");
    },
  };
}

function parseDecision(content) {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : { type: "extractText" };
  } catch {
    return { type: "extractText" };
  }
}
