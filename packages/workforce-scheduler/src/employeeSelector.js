import { employeeCatalogSeed } from "./employeeCatalogSeed.js";

export function selectEmployeesForRoles(roles, catalog = employeeCatalogSeed) {
  const roleSet = new Set(roles);
  const selected = catalog.filter((employee) => roleSet.has(employee.title));
  const remaining = catalog.filter((employee) => !roleSet.has(employee.title));
  return [...selected, ...remaining];
}
