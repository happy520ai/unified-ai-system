export function aggregateDryRunResults(contributions) {
  return {
    contributionCount: contributions.length,
    summaries: contributions.map((item) => item.summary || item.title || item.employeeId),
    providerCallsMade: false,
  };
}

