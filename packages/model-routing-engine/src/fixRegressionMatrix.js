export function buildFixRegressionMatrix() {
  return [
    "pnpm verify:phase107a-secret-safety",
    "pnpm verify:phase321a-workbench-product-recovery",
    "pnpm smoke:phase308a-desktop-workbench-ui",
    "pnpm verify:phase1131-1140-final-ui-experience-lock",
    "pnpm verify:phase1161-1180-bug-intake-governance",
    "pnpm -r --if-present check"
  ];
}
