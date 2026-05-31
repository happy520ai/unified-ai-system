function renderList(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

export function renderOwnerSignalCard({ id, kind, kicker, title, items }) {
  return `
                  <article class="owner-summary-card owner-summary-card-${kind}" id="${id}" data-owner-summary-card="${kind}">
                    <div class="owner-card-title">
                      <span class="owner-card-kicker">${kicker}</span>
                      <strong>${title}</strong>
                    </div>
                    <ul>${renderList(items)}</ul>
                  </article>`;
}



