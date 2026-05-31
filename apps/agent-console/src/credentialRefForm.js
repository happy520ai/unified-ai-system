export function validateCredentialRefForm({ credentialRefType, credentialRef }) {
  const value = String(credentialRef || "");
  if (!value.trim()) return { accepted: false, code: "CREDENTIAL_REF_MISSING" };
  if (!["env_key_name", "encrypted_reference", "vault_reference", "user_secret_store_reference"].includes(String(credentialRefType))) {
    return { accepted: false, code: "UNSUPPORTED_CREDENTIAL_REF_TYPE" };
  }
  if (/sk-|nvapi-|secret|token|bearer\s+/i.test(value) && !/^[A-Z0-9_]+$/.test(value)) {
    return { accepted: false, code: "SECRET_LIKE_INPUT_REJECTED" };
  }
  return { accepted: true, code: "CREDENTIAL_REF_ACCEPTED", credentialRefOnly: true, secretValueAllowed: false };
}
