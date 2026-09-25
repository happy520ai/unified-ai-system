// T-094 leaf: type-only declaration extracted from governedAgentTaskProfile.ts
// (mechanical move certified by .pm/t094-leaf-closures.json).

export type GovernedAgentTaskVerificationResult = Readonly<{
  version: 1; adapter: "node-test"; minimumPassed: number;
  requiredChecks: readonly Readonly<{ file: string; name: string }>[];
}>;
