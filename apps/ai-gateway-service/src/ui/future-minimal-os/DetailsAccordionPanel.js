const detailRows = [
  {
    title: "Security Boundary",
    body: "All operations are sandboxed. No direct access to your data or systems.",
    tag: "Verified",
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5.4c0 4.2-2.9 7.9-7 9.6-4.1-1.7-7-5.4-7-9.6V6l7-3Zm0 4.2a2.2 2.2 0 0 0-2.2 2.2v1H9v5.4h6v-5.4h-.8v-1A2.2 2.2 0 0 0 12 7.2Zm0 1.4c.5 0 .8.3.8.8v1h-1.6v-1c0-.5.3-.8.8-.8Z"/></svg>`
  },
  {
    title: "Provider",
    body: "CredentialRef-only. No provider call from this screen.",
    tag: "Details",
    folded: true,
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 2.4L6.4 8.5 12 11.6l5.6-3.1L12 5.4Zm-6 5.2v4.8l5 2.8v-4.8l-5-2.8Zm7 7.6 5-2.8v-4.8l-5 2.8v4.8Z"/></svg>`
  },
  {
    title: "Evidence",
    body: "Execution logs and results stay local for review.",
    tag: "Details",
    folded: true,
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v4h4v14H3V7h4V3Zm2 0v4h6V3H9Zm3 7a3 3 0 0 0-3 3H6l4 4 4-4h-3a1 1 0 1 1 1 1v2a3 3 0 0 0 0-6Zm5 2h2v5h-2v-5Z"/></svg>`
  },
  {
    title: "Advanced Diagnostics",
    body: "For troubleshooting only.",
    tag: "",
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a4 4 0 0 1 4 4v1.2a6 6 0 0 1 2 1.6l1.1-.6 1.5 2.6-1.1.7c.1.5.2 1 .2 1.5s-.1 1-.2 1.5l1.1.7-1.5 2.6-1.1-.6a6 6 0 0 1-2 1.6V20H8v-1.2a6 6 0 0 1-2-1.6l-1.1.6-1.5-2.6 1.1-.7A7.4 7.4 0 0 1 4.3 13c0-.5.1-1 .2-1.5l-1.1-.7 1.5-2.6 1.1.6a6 6 0 0 1 2-1.6V6a4 4 0 0 1 4-4Zm0 2a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>`
  }
];

export function renderDetailsAccordionPanel() {
  return `
                  <section class="future-details-accordion" aria-label="Details drawer preview">
                    ${detailRows.map((row) => `
                      <article>
                        <div class="future-accordion-icon">${row.icon}</div>
                        <div>
                          <strong>${row.title}</strong>
                          <p>${row.body}</p>
                        </div>
                        ${row.tag ? `<button type="button">${row.tag}${row.folded ? "⌄" : ""}</button>` : `<span class="future-toggle-dot" aria-hidden="true"></span>`}
                      </article>`).join("")}
                  </section>`;
}
