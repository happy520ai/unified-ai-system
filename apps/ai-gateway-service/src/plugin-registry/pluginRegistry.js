const REGISTRY = [
  {
    id: "browser-use",
    title: "Browser Use",
    enabled: false,
    status: "approval_required",
    executionMode: "manual_approval_required",
    note: "插件默认禁用。启用或执行前必须人工审批，不自动运行外部命令。",
  },
];

export function getPluginRegistry() {
  return {
    plugins: REGISTRY.map((plugin) => ({ ...plugin })),
    enabledCount: REGISTRY.filter((plugin) => plugin.enabled === true).length,
    disabledCount: REGISTRY.filter((plugin) => plugin.enabled !== true).length,
    externalCommandExecuted: false,
  };
}
