export function renderGuardedCandidateNotice({ id, body, extraAttributes = "" }) {
  return `<div class="three-mode-notice" id="${id}"${extraAttributes}>${body}</div>`;
}


