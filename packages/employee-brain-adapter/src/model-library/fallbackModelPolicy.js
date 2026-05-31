export function applyFallbackModelPolicy(primaryBinding, fallbackBindings = []) {
  return {
    selectedBinding: primaryBinding || fallbackBindings[0] || null,
    fallbackUsed: !primaryBinding && fallbackBindings.length > 0,
    providerCallsMade: false,
  };
}

