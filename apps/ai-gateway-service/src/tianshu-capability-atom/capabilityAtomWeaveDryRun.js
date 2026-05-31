export function weaveCapabilityAtomsDryRun(atoms, selectedTitles) {
  const selectedSet = new Set(selectedTitles);
  const byTitle = new Map(atoms.map((atom) => [atom.title, atom]));
  const nodes = atoms
    .filter((atom) => selectedSet.has(atom.title) || atom.deps.some((dep) => selectedSet.has(dep)))
    .map((atom) => ({
      atomId: atom.atomId,
      title: atom.title,
      riskLevel: atom.riskLevel,
      requiresProvider: atom.requiresProvider,
      executionAllowed: false,
    }));
  const edges = [];
  const missing = [];
  for (const title of selectedTitles) {
    const atom = byTitle.get(title);
    if (!atom) {
      missing.push(title);
      continue;
    }
    for (const dep of atom.deps) {
      if (byTitle.has(dep)) edges.push({ from: dep, to: title, dryRunOnly: true });
      else missing.push(dep);
    }
  }
  return {
    dryRunExecuted: true,
    arbitraryCodeExecuted: false,
    dependencyGraphGenerated: true,
    dependencyGraph: { nodes, edges },
    resolvedAtomCount: 0,
    graphNodeCount: nodes.length,
    missingDependencyCount: missing.length,
    missingDependencies: missing,
    conflictCount: 0,
    executionAllowed: false,
  };
}
