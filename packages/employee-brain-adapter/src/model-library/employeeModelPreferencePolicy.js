export function chooseEmployeeModelPreference(employee, availableBindings = []) {
  const preferred = availableBindings.find((binding) => binding.domain === employee?.domain) || availableBindings[0] || null;
  return {
    employeeId: employee?.employeeId || null,
    binding: preferred,
    mode: "dry_run",
  };
}

