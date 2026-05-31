export const FORBIDDEN_CAPABILITY_ATOM_FIELDS = Object.freeze([
  "code",
  "sourceCode",
  "pythonCode",
  "javascriptCode",
  "execBody",
  "runtimeScript",
]);

export const REQUIRED_CAPABILITY_ATOM_FIELDS = Object.freeze([
  "atomId",
  "version",
  "title",
  "description",
  "capabilityTags",
  "inputContract",
  "outputContract",
  "deps",
  "positiveSources",
  "negativeSources",
  "constraintSources",
  "riskLevel",
  "allowedModes",
  "allowedEffects",
  "requiresHumanApproval",
  "requiresProvider",
  "requiresSecret",
  "supportsDryRun",
  "evidenceRefs",
  "rollbackNote",
]);

export const CAPABILITY_ATOM_ALLOWED_EFFECTS = Object.freeze([
  "read_evidence",
  "read_docs",
  "read_ui_state",
  "dry_run_plan",
  "summarize",
  "risk_assess",
]);

export const CAPABILITY_ATOM_ALLOWED_MODES = Object.freeze(["normal", "god", "tianshu"]);
export const CAPABILITY_ATOM_RISK_LEVELS = Object.freeze(["low", "medium", "high", "blocked"]);

export function validateCapabilityAtomShape(atom) {
  const failures = [];
  for (const field of REQUIRED_CAPABILITY_ATOM_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(atom, field)) failures.push(`missing:${field}`);
  }
  for (const field of FORBIDDEN_CAPABILITY_ATOM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(atom, field)) failures.push(`forbidden_field:${field}`);
  }
  if (!Array.isArray(atom.capabilityTags) || atom.capabilityTags.length === 0) failures.push("capability_tags_required");
  if (!Array.isArray(atom.deps)) failures.push("deps_array_required");
  if (!Array.isArray(atom.allowedModes) || atom.allowedModes.some((mode) => !CAPABILITY_ATOM_ALLOWED_MODES.includes(mode))) {
    failures.push("allowed_modes_invalid");
  }
  if (!Array.isArray(atom.allowedEffects) || atom.allowedEffects.some((effect) => !CAPABILITY_ATOM_ALLOWED_EFFECTS.includes(effect))) {
    failures.push("allowed_effects_invalid");
  }
  if (!CAPABILITY_ATOM_RISK_LEVELS.includes(atom.riskLevel)) failures.push("risk_level_invalid");
  if (atom.requiresSecret === true && atom.riskLevel !== "blocked") failures.push("secret_atom_must_be_blocked");
  if (atom.supportsDryRun !== true) failures.push("supports_dry_run_required");
  return {
    ok: failures.length === 0,
    failures,
  };
}
