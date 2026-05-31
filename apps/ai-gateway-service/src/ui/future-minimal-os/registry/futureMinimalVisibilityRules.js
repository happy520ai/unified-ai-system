export function isFutureMinimalModuleVisible(descriptor, state = {}) {
  if (!descriptor?.userVisible) return false;
  if (descriptor.zone === "diagnostics") return state.detailsOpen === true;
  if (descriptor.zone === "details") return state.detailsOpen === true || descriptor.defaultCollapsed === true;
  return true;
}

export function shouldRenderFutureMinimalModuleCollapsed(descriptor, state = {}) {
  if (descriptor.zone === "diagnostics") return state.detailsOpen !== true;
  if (descriptor.zone === "details") return descriptor.defaultCollapsed !== false;
  return false;
}
