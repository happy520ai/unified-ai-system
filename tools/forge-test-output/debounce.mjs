import { setTimeout, clearTimeout } from 'timers';

/**
 * Debounce function to handle multiple invocations with a specified delay.
 * @param {Function} func - The function to debounce.
 * @param {Number} delay - The delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
export function debounce(func, delay) {
  let timeoutId;

  return function(...args) {
    const context = this;

    // Clear the previous timeout if it exists
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set a new timeout with the specified delay
    timeoutId = setTimeout(() => {
      // Execute the function with the provided arguments and context
      func.apply(context, args);
    }, delay);
  };
}

// Basic example usage (uncomment to test):
// const debouncedLog = debounce(console.log, 500);
// debouncedLog('Hello, Debounce!');
