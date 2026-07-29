export const ROUTE_NOT_HANDLED = Symbol("http-route-not-handled");

export async function dispatchHttpRouteGroups(groups, context) {
  for (const dispatch of groups) {
    const result = await dispatch(context);
    if (result !== ROUTE_NOT_HANDLED) return result;
  }
  return ROUTE_NOT_HANDLED;
}
