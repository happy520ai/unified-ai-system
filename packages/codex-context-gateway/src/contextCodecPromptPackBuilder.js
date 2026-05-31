export function appendContextCodecPromptPackSection(promptPack, nativeNotationContext) {
  const basePrompt = String(promptPack ?? "").trimEnd();
  const compactState = String(nativeNotationContext ?? "").trim();
  if (!compactState) {
    return basePrompt;
  }
  return `${basePrompt}\n\n[Context Codec Compact State]\n${compactState}\n`;
}
