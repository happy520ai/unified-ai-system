import { providerCredentialCopy } from "../copy/providerCredentialCopy.js";
import { renderGuardedCandidateNotice } from "./GuardedCandidateNotice.js";

export function renderProviderCredentialRefPanel() {
  return `
              ${renderGuardedCandidateNotice({
                id: "provider-credentialref-guarded-notice",
                body: providerCredentialCopy.guardedNotice,
                extraAttributes: ' data-provider-setup-guidance="true"',
              })}
              <div class="surface-muted" id="provider-credentialref-guidance" data-credentialref-only-copy="true" style="margin-top:14px;">
                ${providerCredentialCopy.guidance}
              </div>`;
}


