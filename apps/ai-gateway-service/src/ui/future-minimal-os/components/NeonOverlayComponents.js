/**
 * Modal Component — Neon glassmorphism modal
 * Usage: renderModal({ title: "Modal Title", body: "Modal body", actions: [...] })
 */
export function renderModal({ title = "", body = "", actions = [], id = "", open = false }) {
  const actionsHtml = actions
    .map(
      (action) => `
    <button type="button" class="future-modal__action ${action.primary ? "future-modal__action--primary" : ""}" ${action.onclick ? `onclick="${action.onclick}"` : ""}>
      ${action.label}
    </button>`
    )
    .join("");

  return `
    <dialog class="future-modal" ${id ? `id="${id}"` : ""} ${open ? "open" : ""} aria-labelledby="${id ? `${id}-title` : "modal-title"}">
      <div class="future-modal__backdrop" aria-hidden="true"></div>
      <div class="future-modal__content" role="dialog" aria-modal="true">
        <header class="future-modal__header">
          <h2 class="future-modal__title" id="${id ? `${id}-title` : "modal-title"}">${title}</h2>
          <button type="button" class="future-modal__close" aria-label="Close modal" onclick="this.closest('dialog').close()">✕</button>
        </header>
        <div class="future-modal__body">
          ${body}
        </div>
        ${actionsHtml ? `<footer class="future-modal__footer">${actionsHtml}</footer>` : ""}
      </div>
    </dialog>
  `;
}

/**
 * Drawer Component — Neon glassmorphism drawer
 * Usage: renderDrawer({ title: "Drawer Title", body: "Drawer body", side: "right" })
 */
export function renderDrawer({ title = "", body = "", side = "right", id = "", open = false }) {
  return `
    <dialog class="future-drawer future-drawer--${side}" ${id ? `id="${id}"` : ""} ${open ? "open" : ""} aria-labelledby="${id ? `${id}-title` : "drawer-title"}">
      <div class="future-drawer__backdrop" aria-hidden="true"></div>
      <div class="future-drawer__content" role="dialog" aria-modal="true">
        <header class="future-drawer__header">
          <h2 class="future-drawer__title" id="${id ? `${id}-title` : "drawer-title"}">${title}</h2>
          <button type="button" class="future-drawer__close" aria-label="Close drawer" onclick="this.closest('dialog').close()">✕</button>
        </header>
        <div class="future-drawer__body">
          ${body}
        </div>
      </div>
    </dialog>
  `;
}

/**
 * Tab Bar Component — Neon tab bar with sliding indicator
 * Usage: renderTabBar({ tabs: [{ id: "tab1", label: "Tab 1", active: true }, ...] })
 */
export function renderTabBar({ tabs = [], id = "" }) {
  const tabsHtml = tabs
    .map(
      (tab) => `
    <button type="button" class="future-tab ${tab.active ? "future-tab--active" : ""}" role="tab" aria-selected="${tab.active ? "true" : "false"}" aria-controls="${tab.id}-panel" ${tab.onclick ? `onclick="${tab.onclick}"` : ""}>
      ${tab.label}
    </button>`
    )
    .join("");

  return `
    <div class="future-tab-bar" ${id ? `id="${id}"` : ""} role="tablist" aria-label="Tabs">
      ${tabsHtml}
      <div class="future-tab-bar__indicator" aria-hidden="true"></div>
    </div>
  `;
}
