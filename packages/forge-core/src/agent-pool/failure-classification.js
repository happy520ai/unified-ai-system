/**
 * Failure Classification & Targeted Fix Prompts
 * Categorizes verification failures and generates customized retry prompts
 */

/**
 * Classify verification failures into categories for targeted fix prompts.
 * Examines error output text and check names to determine the failure type.
 *
 * @param {object} verifyResult — verification engine result with `failures` array
 * @returns {{ primary: string, categories: Map<string, Array<object>> }}
 */
export function classifyFailure(verifyResult) {
  const categories = new Map();
  const failures = verifyResult.failures || [];

  for (const failure of failures) {
    const output = (failure.output || failure.message || '').toLowerCase();
    const checkName = (failure.checkName || failure.name || '').toLowerCase();
    let category = 'logic'; // default category

    if (output.includes('syntaxerror') || output.includes('parse error') ||
        output.includes('unexpected token') || output.includes('unexpected character') ||
        checkName.includes('syntax') || checkName.includes('lint') || checkName.includes('eslint')) {
      category = 'syntax';
    } else if (output.includes('error ts') || (output.includes('type ') && output.includes('is not assignable')) ||
               output.includes('type mismatch') || (output.includes("property '") && output.includes('does not exist')) ||
               checkName.includes('typecheck') || checkName.includes('tsc')) {
      category = 'type';
    } else if (output.includes('cannot find module') || output.includes('module_not_found') ||
               output.includes('cannot resolve') || output.includes('module not found') ||
               checkName.includes('import') || checkName.includes('resolve')) {
      category = 'import';
    } else if (output.includes('typeerror') || output.includes('referenceerror') ||
               output.includes('is not defined') || output.includes('cannot read propert') ||
               output.includes('is null') || output.includes('is undefined') ||
               output.includes('null is not') || output.includes('undefined is not')) {
      category = 'runtime';
    } else if (output.includes('vulnerability') || output.includes('cve-') || output.includes('security') ||
               output.includes('xss') || output.includes('injection') ||
               checkName.includes('security') || checkName.includes('audit')) {
      category = 'security';
    } else if (output.includes('expected') || output.includes('assertionerror') || output.includes('assert') ||
               output.includes('toequal') || output.includes('tobe') || output.includes('to.deep') ||
               output.includes('expect(') || checkName.includes('test')) {
      category = 'logic';
    }

    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(failure);
  }

  // Determine primary category (the one with the most failures)
  let primary = 'logic';
  let maxCount = 0;
  for (const [cat, items] of categories) {
    if (items.length > maxCount) {
      maxCount = items.length;
      primary = cat;
    }
  }

  return { primary, categories };
}

/**
 * Build a failure-category-specific fix prompt for targeted verification retries.
 * Produces customized guidance based on the dominant error classification.
 *
 * @param {object} verifier - state.verifier (VerificationEngine instance)
 * @param {{ primary: string, categories: Map<string, Array<object>> }} classification
 * @param {object} verifyResult — verification engine result
 * @param {object} task — the original task
 * @param {string[]} targetFiles — files to scope the fix to
 * @param {number} attempt — current retry attempt number
 * @param {number} maxRetries — maximum retry attempts
 * @returns {string} — the targeted fix prompt
 */
export function buildFixPrompt(verifier, classification, verifyResult, task, targetFiles, attempt, maxRetries) {
  const { primary, categories } = classification;
  const failureContext = verifier.formatFailuresForRetry(verifyResult.failures);
  const fileList = targetFiles.map(f => `- ${f}`).join('\n');

  let prompt = `[TARGETED FIX — Verification Failure ${attempt}/${maxRetries}]\n` +
    `Your previous code changes to the following file(s) failed automated verification:\n${fileList}\n\n` +
    `## Verification Failures\n${failureContext}\n\n` +
    `## Instructions\n` +
    `1. READ each file listed above to see its current state.\n` +
    `2. FIX ONLY the specific issues described in the verification failures.\n` +
    `3. Do NOT rewrite unrelated code. Make minimal, targeted edits.\n` +
    `4. After fixing, the code must pass: syntax check, linting, and tests.\n` +
    `5. Use "edit" actions for small fixes, "write" only if the file needs major restructuring.\n`;

  // Add category-specific guidance based on the dominant failure type
  switch (primary) {
    case 'syntax':
      prompt += `\n## SYNTAX ERROR GUIDANCE\n` +
        `The failures are primarily **syntax/parse errors**. Focus on:\n` +
        `- Check the exact line numbers reported in each error.\n` +
        `- Look for missing closing brackets, parentheses, or braces.\n` +
        `- Ensure all string literals are properly terminated.\n` +
        `- Verify that arrow functions, template literals, and destructuring are syntactically correct.\n` +
        `- Make the smallest possible edit to fix each syntax error.\n`;
      break;

    case 'type':
      prompt += `\n## TYPE ERROR GUIDANCE\n` +
        `The failures are primarily **TypeScript type errors**. Focus on:\n` +
        `- Review the type mismatch details (expected type vs actual type).\n` +
        `- Add or correct type annotations on function parameters and return values.\n` +
        `- Ensure interfaces and type definitions match actual usage.\n` +
        `- Use type assertions sparingly — prefer fixing the underlying types.\n` +
        `- If a property doesn't exist on a type, either add it to the interface or use optional chaining.\n`;
      break;

    case 'runtime':
      prompt += `\n## RUNTIME ERROR GUIDANCE\n` +
        `The failures are primarily **runtime errors** (TypeError, ReferenceError, null/undefined access). Focus on:\n` +
        `- Add null checks or optional chaining (\`?.\`) before accessing properties on potentially null/undefined values.\n` +
        `- Ensure variables are properly initialized before use.\n` +
        `- Check that imported functions/classes actually exist in the source module.\n` +
        `- Review the stack trace to find the exact line where the error occurs.\n`;
      break;

    case 'logic':
      prompt += `\n## LOGIC/ASSERTION ERROR GUIDANCE\n` +
        `The failures are primarily **test assertion failures** (expected vs actual mismatch). Focus on:\n` +
        `- Review the expected vs actual values in each failing assertion.\n` +
        `- Check the algorithm or business logic that produces the output being tested.\n` +
        `- Ensure edge cases are handled correctly (empty arrays, zero values, boundary conditions).\n` +
        `- Verify that the implementation matches the specification the tests are checking.\n`;
      break;

    case 'import':
      prompt += `\n## IMPORT/MODULE ERROR GUIDANCE\n` +
        `The failures are primarily **module not found errors**. Focus on:\n` +
        `- Verify the import path is correct (relative path, file extension).\n` +
        `- Check that the module being imported actually exists and exports the expected symbols.\n` +
        `- If importing a named export, ensure it's exported with that exact name.\n` +
        `- For default imports, ensure the module has a default export.\n` +
        `- Check for circular dependencies that might cause module resolution failures.\n`;
      break;

    case 'security':
      prompt += `\n## SECURITY FINDING GUIDANCE\n` +
        `The failures are primarily **security audit findings**. Focus on:\n` +
        `- Review the vulnerability description and affected code location.\n` +
        `- Replace unsafe patterns with safe alternatives (e.g., avoid eval, use parameterized queries).\n` +
        `- Sanitize user input before using it in queries, HTML, or system commands.\n` +
        `- Ensure sensitive data is not exposed in logs, error messages, or responses.\n`;
      break;
  }

  // If there are multiple failure categories, mention secondary issues
  if (categories.size > 1) {
    const secondary = [...categories.keys()].filter(c => c !== primary);
    prompt += `\n## ADDITIONAL ISSUES\n` +
      `There are also ${secondary.join(', ')} issues. Address those after fixing the primary ${primary} errors.\n`;
  }

  return prompt;
}
