export function createWorkbenchStateStore(initialState = {}) {
  let state = { ...initialState };

  return {
    getState() {
      return state;
    },
    setState(patch) {
      state = {
        ...state,
        ...(typeof patch === "function" ? patch(state) : patch),
      };
      return state;
    },
    reset(nextState = {}) {
      state = { ...nextState };
      return state;
    },
  };
}
