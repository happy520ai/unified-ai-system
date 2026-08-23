const ROLE_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ceo: Object.freeze([]),
  pm: Object.freeze(["ceo"]),
  architect: Object.freeze(["ceo"]),
  "frontend-engineer": Object.freeze(["pm", "architect"]),
  "backend-engineer": Object.freeze(["pm", "architect"]),
  qa: Object.freeze(["frontend-engineer", "backend-engineer"]),
  reviewer: Object.freeze(["qa"]),
});

export function getWorkforceRoleDependencies(roleId: string): string[] {
  return [...(ROLE_DEPENDENCIES[String(roleId)] ?? [])];
}

export function createWorkforceExecutionWaves(roleIds: readonly string[], maxConcurrent: number): string[][] {
  const orderedRoles = [...new Set(roleIds.map(String))];
  const selectedRoles = new Set(orderedRoles);
  const pending = new Set(orderedRoles);
  const completed = new Set<string>();
  const waves: string[][] = [];
  const parsed = Number(maxConcurrent);
  const concurrency = !Number.isFinite(parsed) || parsed < 1 ? 1 : Math.min(16, Math.floor(parsed));
  while (pending.size > 0) {
    const ready = orderedRoles.filter((roleId) => pending.has(roleId)
      && getWorkforceRoleDependencies(roleId)
        .filter((dependency) => selectedRoles.has(dependency))
        .every((dependency) => completed.has(dependency)));
    if (ready.length === 0) {
      const error = new Error("Workforce role graph contains a cycle or an unsatisfied dependency.");
      Object.assign(error, { code: "WORKFORCE_DAG_BLOCKED", pendingRoles: [...pending] });
      throw error;
    }
    const wave = ready.slice(0, concurrency);
    waves.push(wave);
    for (const roleId of wave) {
      pending.delete(roleId);
      completed.add(roleId);
    }
  }
  return waves;
}

export const WORKFORCE_ROLE_DEPENDENCIES = ROLE_DEPENDENCIES;
