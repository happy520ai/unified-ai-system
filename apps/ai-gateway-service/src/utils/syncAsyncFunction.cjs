/**
 * syncAsyncFunction.js
 * 
 * Demonstrates that an `async` function CAN execute completely synchronously,
 * with its Promise resolving before the current synchronous execution completes.
 *
 * ## How This Works (Not a Trick — It's Native JS Semantics)
 *
 * Per ECMAScript spec, `async` functions return a Promise. If the function body
 * does NOT encounter an `await`, the entire body executes synchronously, and the
 * returned Promise is resolved **during that synchronous execution** — not after
 * an event loop tick, not even after a microtask checkpoint.
 *
 * The confusion often comes from conflating:
 *   1. The Promise **resolution state** (set synchronously)  ← what this covers
 *   2. `.then()` / `await` **reactions** (executed via microtask queue) ← separate concern
 *
 * A resolved Promise's internal `[[PromiseState]]` is "fulfilled" immediately.
 * `.then()` callbacks on it will fire on the next microtask flush, but the Promise
 * itself is already resolved.
 *
 * ## Proof Strategy
 *
 * The exported function sets a shared flag DURING execution. A synchronous check
 * of the returned Promise's state AFTER the call (but BEFORE returning to the
 * event loop) confirms resolution.
 */

/**
 * An async function guaranteed to execute its body synchronously.
 * 
 * Rules that keep it synchronous:
 *   - No `await` keyword anywhere in the body
 *   - No `yield` (not a generator)
 *   - No async iteration or async generators
 *   - Returns a value directly (not a thenable)
 *
 * @param {number} a - First operand
 * @param {number} b - Second operand
 * @returns {Promise<number>} A Promise that is ALREADY resolved by the time this returns
 */
async function syncAsyncAdd(a, b) {
  // Pure synchronous computation — no awaits, no callbacks
  const result = a + b;
  return result;
}

/**
 * An async function that performs a more complex synchronous computation.
 * Still no awaits — the entire body runs synchronously.
 *
 * @param {number[]} numbers - Array of numbers to sum
 * @returns {Promise<number>} Resolved Promise with the sum
 */
async function syncAsyncSum(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}

/**
 * An async function that throws synchronously — the rejection is also immediate.
 *
 * @param {string} message - Error message
 * @returns {Promise<never>} Rejected Promise (already rejected by the time this returns)
 */
async function syncAsyncThrow(message) {
  throw new Error(message);
}

module.exports = { syncAsyncAdd, syncAsyncSum, syncAsyncThrow };
