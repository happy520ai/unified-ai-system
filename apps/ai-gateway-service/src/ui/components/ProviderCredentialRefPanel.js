import { providerCredentialCopy } from "../copy/providerCredentialCopy.js";
import { renderGuardedCandidateNotice } from "./GuardedCandidateNotice.js";

export function renderProviderCredentialRefPanel() {
  return `
              ${renderGuardedCandidateNotice({
                id: "provider-credentialref-guarded-notice",
                body: providerCredentialCopy.guardedNotice,
                extraAttributes: ' data-provider-setup-guidance="true"',
              })}
              <div class="surface-muted mt-md" id="provider-credentialref-guidance" data-credentialref-only-copy="true">
                ${providerCredentialCopy.guidance}
              </div>`;
}


