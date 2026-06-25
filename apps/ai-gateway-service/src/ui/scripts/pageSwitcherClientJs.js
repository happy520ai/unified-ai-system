export const pageSwitcherClientJs = `
(function() {
  var titles = {
    chat: "\\u5c0f\\u5929\\u603b\\u63a7\\u53f0",
    models: "\\u6a21\\u578b",
    approvals: "\\u4efb\\u52a1",
    files: "\\u5b89\\u5168",
    diagnostics: "\\u8bbe\\u7f6e",
    "local-agent": "\\u672c\\u5730\\u667a\\u80fd\\u4f53",
    repair: "\\u5b89\\u5168\\u4fee\\u590d",
    help: "\\u4f7f\\u7528\\u5e2e\\u52a9"
  };
  function switchPage(pageId) {
    document.querySelectorAll("[data-page]").forEach(function(node) {
      node.classList.toggle("is-active", node.getAttribute("data-page") === pageId);
    });
    document.querySelectorAll("[data-nav]").forEach(function(node) {
      var isActive = node.getAttribute("data-nav") === pageId;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    var titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = titles[pageId] || "\\u5c0f\\u5929\\u603b\\u63a7";
    if (window.__setActivePage) window.__setActivePage(pageId);
  }
  document.querySelectorAll(".nav-card[data-nav]").forEach(function(card) {
    card.addEventListener("click", function(e) {
      e.stopPropagation();
      switchPage(this.getAttribute("data-nav"));
    });
  });
})();
`;
