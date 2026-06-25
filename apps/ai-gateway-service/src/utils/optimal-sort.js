/**
 * Optimal Comparison-Based Sort
 * ==============================
 * Implements top-down merge sort, which achieves the information-theoretic
 * lower bound of Θ(n log n) comparisons for comparison-based sorting.
 *
 * WHY THIS IS OPTIMAL:
 *   - Any comparison-based sort requires Ω(n log n) comparisons (worst case).
 *     Proof: There are n! permutations; a binary decision tree of height h
 *     has at most 2^h leaves, so 2^h ≥ n! → h ≥ log₂(n!) = Θ(n log n).
 *   - Merge sort performs exactly ⌈log₂(n)⌉ levels of merging, each level
 *     processing all n elements → O(n log n) total.
 *   - It is stable (preserves order of equal elements).
 *   - It uses O(n) auxiliary space.
 *
 * COMPLEXITY:
 *   Time:  O(n log n) — best, average, AND worst case.
 *   Space: O(n) auxiliary.
 *   Comparisons: Θ(n log n) — matches the theoretical lower bound.
 *
 * @param {Array} arr       - The array to sort.
 * @param {Function} [cmp]  - Comparator (a, b) => negative if a < b, 0 if equal, positive if a > b.
 *                            Defaults to natural ascending order for numbers.
 * @returns {Array} A new sorted array (does not mutate the original).
 */
function sort(arr, cmp) {
  if (!Array.isArray(arr)) {
    throw new TypeError('sort() expects an array');
  }

  const compare = cmp || defaultCompare;
  const n = arr.length;

  // Base cases: arrays of length 0 or 1 are already sorted.
  if (n <= 1) return arr.slice();

  // Allocate a single auxiliary array once and reuse it for all merges.
  // This avoids repeated allocation overhead.
  const aux = new Array(n);

  // Copy input so we don't mutate the original.
  const src = arr.slice();

  mergeSort(src, aux, 0, n - 1, compare);
  return src;
}

/**
 * Recursively sorts src[lo..hi] using merge sort.
 * Uses aux as scratch space during merging.
 */
function mergeSort(src, aux, lo, hi, cmp) {
  if (lo >= hi) return;

  const mid = lo + ((hi - lo) >> 1);  // avoids overflow vs (lo+hi)/2

  mergeSort(src, aux, lo, mid, cmp);
  mergeSort(src, aux, mid + 1, hi, cmp);

  // Optimization: if the last element of the left half is ≤ the first
  // element of the right half, the subarrays are already in order.
  if (cmp(src[mid], src[mid + 1]) <= 0) return;

  merge(src, aux, lo, mid, hi, cmp);
}

/**
 * Merges src[lo..mid] and src[mid+1..hi] into sorted order.
 * Uses aux[] as scratch space.
 */
function merge(src, aux, lo, mid, hi, cmp) {
  // Copy both halves into auxiliary array.
  for (let k = lo; k <= hi; k++) {
    aux[k] = src[k];
  }

  let i = lo;
  let j = mid + 1;

  for (let k = lo; k <= hi; k++) {
    if (i > mid) {
      // Left half exhausted → take from right.
      src[k] = aux[j++];
    } else if (j > hi) {
      // Right half exhausted → take from left.
      src[k] = aux[i++];
    } else if (cmp(aux[j], aux[i]) < 0) {
      // Right element is smaller → take it (and note this is NOT ≤,
      // which ensures stability: equal elements keep their original order).
      src[k] = aux[j++];
    } else {
      src[k] = aux[i++];
    }
  }
}

/**
 * Default comparator for numeric ascending order.
 */
function defaultCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── Exports ───────────────────────────────────────────────────────────
module.exports = { sort, mergeSort, defaultCompare };
