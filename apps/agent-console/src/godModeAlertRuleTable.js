export function buildGodModeAlertRuleTable(rules = []) {
  return {
    alertRuleTableVisible: true,
    alertRows: rules.map((rule) => ({
      alertId: rule.alertId,
      metric: rule.metric,
      severity: rule.severity,
      enabled: rule.enabled,
      blocker: rule.blocker,
      message: rule.message,
      recommendedAction: rule.recommendedAction,
      rollbackHint: rule.rollbackHint,
    })),
  };
}
