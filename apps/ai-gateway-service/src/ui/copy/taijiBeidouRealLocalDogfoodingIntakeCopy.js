export const taijiBeidouRealLocalDogfoodingIntakeCopy = Object.freeze({
  title: "Real Local Dogfooding Intake",
  subtitle:
    "Owner daily/weekly ledgers are read as real records only when the owner has actually filled them. Missing owner records keep completion blocked without fabricating feedback.",
  boundary: "local-only / intake started / no production claim",
  status: [
    ["localDogfoodingActive", "true"],
    ["realOwnerDogfoodingCompleted", "false"],
    ["realOneMonthDogfoodingCompleted", "false"],
    ["realTwoMonthDogfoodingCompleted", "false"],
    ["deployDeferred", "true"],
    ["productionReady", "false"],
  ],
  safety: [
    ["providerCallsMade", "false"],
    ["secretRead", "false"],
    ["authJsonRead", "false"],
    ["rawCredentialRefRead", "false"],
    ["providerRuntimeDefaultEnabled", "false"],
    ["recordsFabricated", "false"],
  ],
  severity: [
    ["P0", "stop / disable / block only"],
    ["P1", "risk review; no automatic downgrade"],
    ["P2", "low-risk docs or read-only UI repair allowed"],
    ["P3", "copy, naming, template polish allowed"],
  ],
  nextGates: [
    "Continue local dogfooding records",
    "Repair P2/P3 only",
    "Resolve P1 blockers before expansion",
    "Wait for 1-month owner review",
    "No direct production deploy recommendation",
  ],
});
