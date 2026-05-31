export function limitActiveEmployees(employees, maxActiveEmployeesPerTask = 3) {
  return {
    activeEmployees: employees.slice(0, maxActiveEmployeesPerTask),
    blockedEmployees: employees.slice(maxActiveEmployeesPerTask),
    overloadDryRunBlocksExtraEmployees: employees.length > maxActiveEmployeesPerTask,
  };
}

