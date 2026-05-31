import registry from "./action-registry.json" with { type: "json" };

export function getRegisteredOwnerActions() {
  return registry.actions.map((action) => ({ ...action }));
}

export function getOwnerAutomationActionById(actionId) {
  return registry.actions.find((action) => action.actionId === actionId) ?? null;
}

export const ownerAutomationActionRegistry = registry;
