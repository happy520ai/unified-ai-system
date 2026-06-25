/**
 * The Halting Problem — Demonstration and Explanation
 * ====================================================
 * 
 * Alan Turing proved in 1936 that no such function can exist.
 * This file demonstrates WHY it's impossible, and what we CAN do instead.
 */

// ============================================================================
// THE IMPOSSIBILITY PROOF (by contradiction)
// ============================================================================

/**
 * Suppose, for the sake of contradiction, that willTerminate exists
 * and works correctly for ALL input functions.
 * 
 * Then we could write the following program:
 */

// Step 1: Assume this function exists and is always correct:
function willTerminate(program) {
  // Hypothetically returns:
  //   true  → if program() will eventually halt/return
  //   false → if program() will run forever
  throw new Error("This function CANNOT exist — see proof below.");
}

// Step 2: Using willTerminate, we construct a paradox:
function paradox(program) {
  if (willTerminate(program)) {
    // If the input would terminate, we run forever instead
    while (true) {
      // infinite loop
    }
  } else {
    // If the input would NOT terminate, we halt immediately
    return;
  }
}

// Step 3: Now ask: what happens when we call paradox(paradox)?
//
//   Case A: willTerminate(paradox) === true
//           → paradox sees this and enters infinite loop
//           → But then paradox does NOT terminate!
//           → willTerminate was WRONG. Contradiction! ✗
//
//   Case B: willTerminate(paradox) === false
//           → paradox sees this and returns immediately
//           → But then paradox DOES terminate!
//           → willTerminate was WRONG. Contradiction! ✗
//
// Both cases lead to contradiction, therefore willTerminate cannot exist.

// ============================================================================
// PARTIAL / PRACTICAL ALTERNATIVES
// ============================================================================

/**
 * APPROXIMATION 1: Timeout-based detection
 * 
 * We can't know if something WILL run forever, but we can detect
 * if it HAS BEEN running for "too long."
 */
function willTerminateApproximate(program, timeoutMs = 5000) {
  // This is a practical heuristic, NOT a true halting detector.
  // It can give wrong answers for BOTH cases:
  //   - A terminating program that takes longer than timeout → false (wrong)
  //   - A non-terminating program that happens to throw after timeout → (depends)
  
  let result = undefined;
  let finished = false;
  
  // We can't actually run user code in a thread and kill it cleanly in 
  // Node.js without Worker threads, but here's the concept:
  const start = Date.now();
  
  try {
    // In practice, you'd use a Worker thread with a timeout:
    // const { Worker } = require('worker_threads');
    // ... run program in worker, terminate after timeoutMs
    
    // Simulated approach:
    const origTimeout = global.setTimeout;
    const origSetInterval = global.setInterval;
    
    // This is inherently limited — we can't catch all infinite loops
    throw new Error("Cannot reliably implement even with timeout");
    
  } catch (e) {
    // If it throws, it "terminated" (though not cleanly)
    finished = true;
    result = true;
  }
  
  return result; // Still can't catch infinite loops that don't throw
}

/**
 * APPROXIMATION 2: Static Analysis (conservative)
 * 
 * We can analyze the source code and identify CERTAIN patterns that
 * guarantee non-termination, or guarantee termination. But for most
 * programs, the answer will be "unknown."
 */
function willTerminateStaticAnalysis(program) {
  const src = program.toString();
  
  // ========================================
  // GUARANTEED NON-TERMINATION PATTERNS
  // ========================================
  
  // while(true) with no break/return/throw
  if (/while\s*\(\s*true\s*\)/.test(src)) {
    // Check if there's a break, return, or throw inside
    // (This is a simplification — real analysis is much harder)
    if (!/\b(break|return|throw)\b/.test(src)) {
      return false;  // Will NOT terminate
    }
    // If there IS a break/return/throw, we can't be sure — might or might not
  }
  
  // for(;;) with no break/return/throw
  if (/for\s*\(\s*;\s*;\s*\)/.test(src)) {
    if (!/\b(break|return|throw)\b/.test(src)) {
      return false;
    }
  }
  
  // Recursive call with no base case (trivial detection)
  const funcNameMatch = src.match(/function\s+(\w+)/);
  if (funcNameMatch) {
    const name = funcNameMatch[1];
    const hasRecursion = new RegExp(`\\b${name}\\s*\\(`).test(src.slice(src.indexOf('{')));
    const hasReturn = /\breturn\b/.test(src);
    const hasIf = /\bif\b/.test(src);
    
    if (hasRecursion && !hasReturn && !hasIf) {
      return false;  // Recursive with no base case → won't terminate
    }
  }
  
  // ========================================
  // GUARANTEED TERMINATION PATTERNS
  // ========================================
  
  // No loops, no recursion → always terminates
  const hasLoop = /\b(while|for)\s*\(/.test(src);
  const hasGoto = false; // JS doesn't have goto
  
  if (!hasLoop) {
    // Check for recursion
    if (funcNameMatch) {
      const name = funcNameMatch[1];
      const body = src.slice(src.indexOf('{'));
      if (!new RegExp(`\\b${name}\\s*\\(`).test(body)) {
        return true;  // No loops, no recursion → terminates
      }
    } else {
      return true;  // No named function, no loops → terminates
    }
  }
  
  // ========================================
  // UNKNOWN — the vast majority of cases
  // ========================================
  throw new Error(
    "Cannot determine halting status — this is expected. " +
    "The Halting Problem is undecidable."
  );
}

// ============================================================================
// PROOF OF CORRECTNESS for our impossibility claim
// ============================================================================

/**
 * A self-contained proof that willTerminate cannot work for all functions.
 * This function runs and demonstrates the contradiction.
 */
function demonstrateImpossibility() {
  console.log("=== The Halting Problem: Proof by Contradiction ===\n");
  
  console.log("Theorem: No function willTerminate(f) can exist that:");
  console.log("  1. Takes any JS function f as input");
  console.log("  2. Returns true if f() halts, false if f() loops forever");
  console.log("  3. Always gives the correct answer\n");
  
  console.log("Proof:\n");
  
  console.log("Assume willTerminate exists and is always correct.");
  console.log("Define a function adversary(x) as:\n");
  console.log("  function adversary(x) {");
  console.log("    if (willTerminate(x(x))) {");
  console.log("      while(true) {}   // loop forever");
  console.log("    } else {");
  console.log("      return;            // halt immediately");
  console.log("    }");
  console.log("  }\n");
  
  console.log("Now consider: adversary(adversary)\n");
  
  console.log("Case 1: willTerminate(adversary) returns true");
  console.log("  → adversary(adversary) enters infinite loop");
  console.log("  → But willTerminate said it would halt. CONTRADICTION. ✗\n");
  
  console.log("Case 2: willTerminate(adversary) returns false");
  console.log("  → adversary(adversary) returns immediately");
  console.log("  → But willTerminate said it would loop. CONTRADICTION. ✗\n");
  
  console.log("Both cases yield contradictions.");
  console.log("Therefore, our assumption was false.");
  console.log("∴ willTerminate cannot exist.                    □\n");
  
  console.log("This applies to ANY language, ANY runtime, ANY AI.");
  console.log("It is a fundamental mathematical limitation, not a");
  console.log("limitation of current technology.\n");
}

// ============================================================================
// WHAT WE CAN ACTUALLY BUILD
// ============================================================================

/**
 * The best we can do: a function that TERMINATES for some inputs
 * and honestly throws "don't know" for others.
 * 
 * This is analogous to what real tools do:
 * - Coq/Agda: termination checkers for total functions
 * - SPIN model checker: bounded model checking
 * - Astrée: abstract interpretation for embedded systems
 */
function willTerminateConservative(program) {
  if (typeof program !== 'function') {
    throw new TypeError('Input must be a function');
  }
  
  const src = program.toString().trim();
  
  // ── Trivial cases ──────────────────────────────────────
  
  // Empty function body → terminates
  if (/^(function\s*\w*\s*\([^)]*\)\s*\{\s*\}|[a-zA-Z_]\w*\s*=>\s*\{\s*\})$/.test(src)) {
    return true;
  }
  
  // Arrow function with single expression, no calls → terminates
  if (/^\([^)]*\)\s*=>\s*(?!.*\b\w+\s*\().+$/m.test(src)) {
    return true;
  }
  
  // ── Obvious non-termination ────────────────────────────
  
  // while(true){} with no escape
  if (/while\s*\(\s*(true|!0|1)\s*\)\s*\{\s*\}/.test(src)) {
    return false;
  }
  
  // for(;;){} with no escape
  if (/for\s*\(\s*;\s*;\s*\)\s*\{\s*\}/.test(src)) {
    return false;
  }
  
  // ── Recursive function analysis ────────────────────────
  
  const funcMatch = src.match(/function\s+(\w+)/);
  if (funcMatch) {
    const name = funcMatch[1];
    const bodyStart = src.indexOf('{');
    const body = src.slice(bodyStart);
    
    const callsSelf = new RegExp(`\\b${name}\\s*\\(`).test(body);
    
    if (callsSelf) {
      // Check for base case (if/return pattern)
      const hasConditional = /\bif\b/.test(body) || /\?.*\:/.test(body);
      const hasReturn = /\breturn\b/.test(body);
      
      if (!hasConditional || !hasReturn) {
        return false;  // Recursive without base case
      }
      
      // Has base case but we can't easily verify the recursion terminates
      // → unknown
      throw new UnknownHaltingError(
        `Function "${name}" is recursive with a conditional base case. ` +
        `Cannot determine termination — this requires solving the Halting Problem.`
      );
    }
  }
  
  // ── No loops, no recursion ─────────────────────────────
  
  if (!/\b(while|for)\s*\(/.test(src)) {
    return true;  // Straight-line code always terminates
  }
  
  // ── Unknown ────────────────────────────────────────────
  
  throw new UnknownHaltingError(
    "Cannot determine halting status for this program. " +
    "Use a timeout if you need a practical answer."
  );
}

class UnknownHaltingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownHaltingError';
  }
}

// Run logic moved to bottom (ESM-compatible)

export { willTerminateConservative as willTerminate, UnknownHaltingError, demonstrateImpossibility };

// Run if executed directly
const isMainModule = import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`;
if (isMainModule) {
  demonstrateImpossibility();
  
  console.log("─".repeat(60));
  console.log("However, we CAN build a conservative analysis:\n");
  
  const tests = [
    { name: "Empty function",        fn: function() {} },
    { name: "Return constant",       fn: function() { return 42; } },
    { name: "While(true){}",         fn: function() { while(true){} } },
    { name: "While(true){break}",    fn: function() { while(true){break;} } },
    { name: "Counting loop",         fn: function() { for(let i=0;i<10;i++){} } },
    { name: "Infinite for(;;)",      fn: function() { for(;;){} } },
    { name: "Simple recursion",      fn: function f(n) { return f(n-1); } },
    { name: "Factorial",             fn: function f(n) { if(n<=1) return 1; return n*f(n-1); } },
  ];
  
  for (const { name, fn } of tests) {
    try {
      const result = willTerminateConservative(fn);
      console.log(`  ${name}: ${result ? "✓ halts" : "✗ loops forever"}`);
    } catch (e) {
      if (e instanceof UnknownHaltingError) {
        console.log(`  ${name}: ? unknown (${e.message.split('.')[0]})`);
      } else {
        console.log(`  ${name}: ERROR - ${e.message}`);
      }
    }
  }
  
  console.log("\n" + "─".repeat(60));
  console.log("Key insight: The Halting Problem is UNSOLVABLE in general.");
  console.log("No amount of cleverness, compute power, or AI can change this.");
  console.log("It is a proven mathematical impossibility, like dividing by zero.");
}
