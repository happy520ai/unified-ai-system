export function applyLoadShedding(employees, maxActiveEmployeesPerTask = 3) {
  return {
    kept: employees.slice(0, maxActiveEmployeesPerTask),
    shed: employees.slice(maxActiveEmployeesPerTask).map((employee) => ({
      employeeId: employee.employeeId,
      reason: "load_shedding_policy_limit",
    })),
    noFullCatalogBroadcast: true,
  };
}

