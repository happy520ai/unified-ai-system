export const dryRunLoadPolicy = Object.freeze({
  maxConcurrencyPerEmployee: 1,
  useCache: true,
  queueOverflowAction: "reject_for_preview",
});

export function canScheduleEmployee(employee, policy = dryRunLoadPolicy) {
  return employee.status === "preview_ready" && employee.maxConcurrency <= policy.maxConcurrencyPerEmployee;
}
