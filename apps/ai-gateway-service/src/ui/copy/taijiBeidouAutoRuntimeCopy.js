export const taijiBeidouAutoRuntimeCopy = Object.freeze({
  title: "太极 / 北斗 Auto Runtime v0",
  subtitle: "sandbox/local auto runtime v0 only",
  boundary: "self-use sandbox runtime, production not ready",
  status: [
    ["auto runtime v0", "available"],
    ["sandbox local only", "true"],
    ["production ready", "false"],
    ["real provider runtime", "false"],
    ["main-chain runtime", "false"],
    ["kill switch", "available"],
  ],
  counts: [
    ["admitted", ">=1"],
    ["executed", ">=1"],
    ["blocked", "tracked"],
    ["failed", "tracked"],
    ["disabled", "tracked"],
  ],
  guards: [
    ["provider calls", "blocked"],
    ["secret read", "blocked"],
    ["deploy", "blocked"],
    ["chat mutation", "blocked"],
    ["execute mutation", "blocked"],
    ["production auto-enable", "blocked"],
  ],
  controls: [
    "查看 runtime evidence",
    "查看 blocked reason",
    "查看 rollback plan",
    "查看 admission decision",
  ],
});
