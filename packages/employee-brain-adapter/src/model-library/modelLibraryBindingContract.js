export const modelLibraryBindingContract = Object.freeze({
  requiredRefs: ["providerRef", "modelRef", "credentialRef"],
  credentialRefOnly: true,
  rawSecretAccessed: false,
  secretValueExposed: false,
  defaultMode: "dry_run",
});

export function validateModelLibraryBinding(binding = {}) {
  const missing = modelLibraryBindingContract.requiredRefs.filter((field) => !binding[field]);
  return {
    valid: missing.length === 0,
    missing,
    credentialRefOnly: true,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

