export const routeQualityAuditCopy = Object.freeze({
  title: "Route Quality Audit",
  subtitle: "Read-only audit of Phase916-930 bounded NVIDIA real route quality evidence and design-only tuning recommendations.",
  badges: [
    "Phase931-940",
    "no new Provider requests",
    "eligible pool scoped",
    "design-only tuning",
    "default routes unchanged",
  ],
  safetyLines: [
    "The selectable count of 2 is the strict Phase916-930 NVIDIA test pool, not a global selectable shrinkage.",
    "The next route test plan is not executed in this phase and requires future approval.",
    "No button can call a Provider, increase request volume, modify selectable state, enable /chat defaults, deploy, or read secrets.",
  ],
});
