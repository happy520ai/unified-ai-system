function renderList(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

export function renderOwnerStatusCard({ id, kind, kicker, title, items }) {
  return `
                  <article class="owner-summary-card owner-summary-card-${kind}" id="${id}" data-owner-summary-card="${kind}">
                    <div class="owner-card-title">
                      <strong>${title}</strong>
                      <span class="owner-card-kicker">${kicker}</span>
                    </div>
                    <ul>${renderList(items)}</ul>
                  </article>`;
}


