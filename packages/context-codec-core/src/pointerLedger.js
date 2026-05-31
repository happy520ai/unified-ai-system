export function buildPointerLedger(evidenceRefs = [], docsRefs = [], fileRefs = []) {
  const groups = [
    ["evidence", Array.isArray(evidenceRefs) ? evidenceRefs.filter(Boolean) : []],
    ["docs", Array.isArray(docsRefs) ? docsRefs.filter(Boolean) : []],
    ["file", Array.isArray(fileRefs) ? fileRefs.filter(Boolean) : []],
  ];
  const refs = groups.flatMap(([kind, values]) => values.map((ref) => ({ kind, ref })));
  const pointers = refs.map((entry, index) => ({
    pointerId: `${entry.kind}:${index + 1}`,
    kind: entry.kind,
    ref: entry.ref,
  }));
  return {
    pointers,
    pointerCoverage: refs.length === 0 ? 1 : pointers.length / refs.length,
  };
}
