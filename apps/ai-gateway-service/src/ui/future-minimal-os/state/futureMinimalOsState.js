export function createInitialFutureMinimalOsState(overrides = {}) {
  return {
    taskText: "",
    previewGenerated: false,
    recommendedMode: "Tianshu",
    detailsOpen: false,
    activeDetailModule: null,
    errorState: null,
    loadingState: false,
    ...overrides
  };
}

export const futureMinimalOsStateKeys = [
  "taskText",
  "previewGenerated",
  "recommendedMode",
  "detailsOpen",
  "activeDetailModule",
  "errorState",
  "loadingState"
];
