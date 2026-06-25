/**
 * Synchronous Async Utilities
 * 
 * This module provides async functions that are declared as async (return Promises)
 * but execute completely synchronously — the Promise resolves in the same microtask
 * without any event loop tick.
 * 
 * Key insight: When an async function returns a value, the JavaScript engine wraps
 * it in a promise that resolves in the same microtask queue. The function body
 * executes synchronously, and the promise resolution happens in the same microtask
 * as the function call.
 */

/**
 * Creates an async function that executes completely synchronously.
 * 
 * The function body executes synchronously, and the returned promise
 * resolves in the same microtask queue as the function call.
 * 
 * @param {Function} syncFn - Synchronous function to execute
 * @returns {AsyncFunction} Async function that executes synchronously
 */
export function createSynchronousAsync(syncFn) {
  // Validate input
  if (typeof syncFn !== 'function') {
    throw new Error('syncFn must be a function');
  }

  // Return an async function that executes synchronously
  return async function synchronousAsyncWrapper(...args) {
    // The function body executes synchronously here
    // The return value is automatically wrapped in a resolved promise
    // by the async function mechanism
    return syncFn(...args);
  };
}

/**
 * Example: Async function that returns a value synchronously.
 * 
 * This function is declared as async, so it returns a Promise.
 * However, the Promise resolves in the same microtask as the call,
 * with no event loop tick between the call and resolution.
 * 
 * @param {any} value - Value to return
 * @returns {Promise<any>} Promise that resolves with the value
 */
export async function synchronousReturn(value) {
  // This executes synchronously
  // The return value is wrapped in a resolved promise
  // that resolves in the same microtask
  return value;
}

/**
 * Example: Async function that performs synchronous computation.
 * 
 * This function performs computation synchronously and returns
 * the result in a promise that resolves in the same microtask.
 * 
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {Promise<number>} Promise that resolves with the sum
 */
export async function synchronousAdd(a, b) {
  // Synchronous computation
  const result = a + b;
  // Return synchronously - promise resolves in same microtask
  return result;
}

/**
 * Example: Async function that performs synchronous error handling.
 * 
 * This function throws synchronously if validation fails,
 * and the error is captured by the async function mechanism.
 * 
 * @param {any} value - Value to validate
 * @param {string} errorMessage - Error message if validation fails
 * @returns {Promise<any>} Promise that resolves with the value or rejects
 */
export async function synchronousValidate(value, errorMessage) {
  // Synchronous validation
  if (!value) {
    throw new Error(errorMessage || 'Validation failed');
  }
  // Return synchronously
  return value;
}

/**
 * Creates a factory for synchronous async functions.
 * 
 * @param {Object} syncFunctions - Object mapping function names to synchronous implementations
 * @returns {Object} Object with async versions of the functions
 */
export function createSynchronousAsyncFactory(syncFunctions) {
  const asyncFunctions = {};
  
  for (const [name, syncFn] of Object.entries(syncFunctions)) {
    if (typeof syncFn !== 'function') {
      throw new Error(`${name} must be a function`);
    }
    asyncFunctions[name] = createSynchronousAsync(syncFn);
  }
  
  return asyncFunctions;
}

/**
 * Utility to verify that an async function executes synchronously.
 * 
 * This function tests whether an async function's promise resolves
 * in the same microtask as the call.
 * 
 * @param {Function} asyncFn - Async function to test
 * @param {Array} args - Arguments to pass to the function
 * @returns {Promise<boolean>} Promise that resolves with true if synchronous
 */
export async function verifySynchronousExecution(asyncFn, args = []) {
  let executionOrder = [];
  
  // Call the async function
  const promise = asyncFn(...args);
  
  // Push to execution order
  executionOrder.push('call');
  
  // Schedule microtasks
  queueMicrotask(() => {
    executionOrder.push('microtask-1');
  });
  
  queueMicrotask(() => {
    executionOrder.push('microtask-2');
  });
  
  // Await the promise
  const result = await promise;
  
  // Push to execution order
  executionOrder.push('await');
  
  // If the function executed synchronously, the promise should have
  // resolved before the microtasks scheduled after the call
  return executionOrder.join(',') === 'call,await,microtask-1,microtask-2';
}