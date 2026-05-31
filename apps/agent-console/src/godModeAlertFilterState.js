export function buildGodModeAlertFilterState({ severity = "all", blockerOnly = false } = {}) {
  return {
    filterStateVisible: true,
    severity,
    blockerOnly,
  };
}

export function applyGodModeAlertFilters(rows = [], { severity = "all", blockerOnly = false } = {}) {
  return rows.filter((row) => {
    if (severity !== "all" && row.severity !== severity) return false;
    if (blockerOnly && row.blocker !== true) return false;
    return true;
  });
}
