export function renderModuleCard({ title, body, meta = "", collapsed = true, id = "" }) {
  if (collapsed) {
    return `
                    <details>
                      <summary>${title}</summary>
                      <div class="future-module-card" ${id ? `id="${id}"` : ""}>
                      ${meta ? `<small>${meta}</small>` : ""}
                      <p>${body}</p>
                      </div>
                    </details>`;
  }
  return `
                    <article class="future-module-card" ${id ? `id="${id}"` : ""}>
                      <strong>${title}</strong>
                      ${meta ? `<small>${meta}</small>` : ""}
                      <p>${body}</p>
                    </article>`;
}
