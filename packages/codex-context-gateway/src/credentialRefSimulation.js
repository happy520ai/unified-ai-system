import { sanitizeText } from "./contextPackPreviewReader.js";

export function buildCredentialRefSimulation(options = {}) {
  return {
    completed: true,
    credentialRefSimulationWorks: true,
    credentialRefOnly: true,
    credentialRef: sanitizeText(options.credentialRef || "credentialRef:phase598-approved-only"),
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    simulatedCredentialOnly: true,
    notes: [
      "Store only the credentialRef and redacted evidence references.",
      "Do not read or print the raw secret value.",
      "Do not read or print webhook contents.",
    ],
  };
}
