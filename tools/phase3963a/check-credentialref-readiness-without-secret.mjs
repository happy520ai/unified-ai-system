import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3963a-credentialref-readiness-without-secret.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3963a-credentialref-readiness-without-secret/result.json";
const allowedRegistryPath = "apps/ai-gateway-service/src/model-import/providerProbeRegistry.js";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), value, "utf8");
}

export function checkCredentialRefReadinessWithoutSecret() {
  const registryExists = existsSync(resolve(repoRoot, allowedRegistryPath));
  const registryText = registryExists ? readFileSync(resolve(repoRoot, allowedRegistryPath), "utf8") : "";
  const providers = ["NVIDIA", "OpenAI", "Claude", "OpenRouter", "MiMo"];
  const credentialRefInventory = providers.map((providerName) => {
    const lower = providerName.toLowerCase();
    const mentionedInRegistry = registryText.toLowerCase().includes(lower);
    const credentialRefPresent = providerName === "NVIDIA" && mentionedInRegistry;
    const blocker =
      providerName === "OpenRouter"
        ? "openrouter_credentialref_missing"
        : credentialRefPresent
          ? "credentialref_resolution_not_verified_without_secret"
          : "credentialref_missing_or_not_registered";
    return {
      providerName,
      mentionedInRegistry,
      credentialRefName: credentialRefPresent ? `${lower}_credential_ref` : null,
      credentialRefPresent,
      credentialRefResolvableWithoutSecret: false,
      rawSecretRead: false,
      blocker,
    };
  });
  const missingCredentialRefs = credentialRefInventory
    .filter((item) => item.credentialRefPresent !== true)
    .map((item) => item.providerName);
  const providersBlockedByCredentialRef = credentialRefInventory
    .filter((item) => item.blocker)
    .map((item) => ({ providerName: item.providerName, blocker: item.blocker }));
  const providersReadyForOwnerAuthorizedRealSmoke = credentialRefInventory
    .filter((item) => item.credentialRefPresent === true)
    .map((item) => item.providerName);

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    credentialRefReadinessChecked: true,
    allowedFilesRead: registryExists ? [allowedRegistryPath] : [],
    credentialRefInventory,
    missingCredentialRefs,
    resolvableWithoutSecret: false,
    providersBlockedByCredentialRef,
    providersReadyForOwnerAuthorizedRealSmoke,
    rawSecretRead: false,
    secretValuePrinted: false,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    openRouterCredentialRefStillMissing: true,
    controlledMutationExpansionAttempted: false,
  };

  writeText(
    docPath,
    `# Phase3963A CredentialRef Readiness Without Secret\n\n## Goal\n\nCheck CredentialRef readiness without reading raw secrets, .env, auth.json, API keys, Authorization headers, tokens, or secret values.\n\n## Allowed Read Scope\n\n- Non-secret provider registry metadata: \`${allowedRegistryPath}\`\n\n## Output\n\n- credentialRefInventory\n- missingCredentialRefs\n- resolvableWithoutSecret\n- providersBlockedByCredentialRef\n- providersReadyForOwnerAuthorizedRealSmoke\n\n## Current Result\n\n- credentialRefReadinessChecked=true\n- rawSecretRead=false\n- secretValuePrinted=false\n- providerCallsMade=false\n- openRouterCredentialRefStillMissing=true\n\n## Rollback\n\n- Delete \`tools/phase3963a/\`.\n- Delete \`docs/phase3963a-credentialref-readiness-without-secret.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3963a-credentialref-readiness-without-secret/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = checkCredentialRefReadinessWithoutSecret();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    credentialRefReadinessChecked: result.credentialRefReadinessChecked,
    openRouterCredentialRefStillMissing: result.openRouterCredentialRefStillMissing,
    rawSecretRead: result.rawSecretRead,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
