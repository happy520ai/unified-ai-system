export function buildGodModeAlertDetailDrawer(selectedAlert = null) {
  return {
    detailDrawerVisible: Boolean(selectedAlert),
    selectedAlertId: selectedAlert?.alertId || null,
    recommendedActionVisible: true,
    recommendedAction: selectedAlert?.recommendedAction || "Review benchmark trend evidence before expanding beta scope.",
    rollbackHint: selectedAlert?.rollbackHint || "Hold beta expansion and rerun benchmark regression.",
  };
}
