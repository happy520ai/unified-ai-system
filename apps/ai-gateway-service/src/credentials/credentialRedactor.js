export function redactSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return "[redacted]";
  return `${text.slice(0, 3)}****${text.slice(-3)}`;
}

export function redactCredentialRef(credentialRef) {
  if (!credentialRef) return "";
  return `ref:${redactSecret(String(credentialRef))}`;
}
