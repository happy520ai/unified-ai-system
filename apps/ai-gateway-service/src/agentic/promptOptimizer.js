/**
 * PromptOptimizer — Automatically adjusts the system prompt based on task type.
 *
 * @module promptOptimizer
 */

const TASK_PATTERNS = {
  refactoring: {
    keywords: ["refactor", "restructure", "rename", "reorganize", "clean up", "simplify"],
    additions: [
      "When refactoring: preserve all existing behavior, change only the structure.",
      "After refactoring, re-read the modified files to verify no functionality was lost.",
      "Keep backward compatibility unless explicitly asked to break it.",
    ],
  },
  debugging: {
    keywords: ["fix", "bug", "error", "crash", "broken", "not working", "issue"],
    additions: [
      "When debugging: first reproduce the issue by reading the error message and relevant code.",
      "Identify the root cause before making any changes.",
      "After fixing, verify the fix by re-reading the modified code.",
      "Consider edge cases that might cause similar issues.",
    ],
  },
  testing: {
    keywords: ["test", "spec", "coverage", "jest", "mocha", "unit test", "e2e"],
    additions: [
      "When writing tests: cover happy path, error cases, and edge cases.",
      "Use descriptive test names that explain the expected behavior.",
      "Follow the existing test patterns in the project.",
      "Keep each test focused on a single behavior.",
    ],
  },
  documentation: {
    keywords: ["document", "readme", "comment", "jsdoc", "explain", "guide"],
    additions: [
      "When documenting: be clear, concise, and include examples where helpful.",
      "Follow existing documentation style in the project.",
      "Include both high-level overview and specific details.",
    ],
  },
  feature: {
    keywords: ["add", "implement", "create", "build", "new feature", "integrate"],
    additions: [
      "When implementing features: start by understanding the existing architecture.",
      "Write code that fits the existing patterns and style.",
      "Add appropriate error handling and edge case coverage.",
      "Consider backward compatibility with existing code.",
    ],
  },
  performance: {
    keywords: ["optimize", "performance", "speed", "memory", "efficient", "cache", "bottleneck"],
    additions: [
      "When optimizing: measure first, optimize second. Don't guess at bottlenecks.",
      "Consider the trade-offs: readability vs performance, memory vs speed.",
      "After optimizing, verify correctness is preserved.",
    ],
  },
};

export function createPromptOptimizer() {
  return {
    /**
     * Detect the task type from the goal description.
     * @param {string} goal
     * @returns {{ type: string, confidence: number }}
     */
    detectTaskType(goal) {
      if (!goal || typeof goal !== "string") return { type: "general", confidence: 0 };

      const lowerGoal = goal.toLowerCase();
      const scores = {};

      for (const [type, pattern] of Object.entries(TASK_PATTERNS)) {
        let matches = 0;
        for (const kw of pattern.keywords) {
          if (lowerGoal.includes(kw)) matches++;
        }
        scores[type] = matches / pattern.keywords.length;
      }

      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const [topType, topScore] = sorted[0];

      return {
        type: topScore > 0 ? topType : "general",
        confidence: Math.round(topScore * 100) / 100,
      };
    },

    /**
     * Enhance a system prompt with task-specific guidance.
     * @param {string} basePrompt - The existing system prompt
     * @param {string} goal - The user's goal
     * @returns {string} Enhanced prompt
     */
    optimize(basePrompt, goal) {
      const { type, confidence } = this.detectTaskType(goal);

      if (confidence < 0.1 || type === "general") return basePrompt;

      const pattern = TASK_PATTERNS[type];
      if (!pattern) return basePrompt;

      const additions = pattern.additions.join("\n");
      return `${basePrompt}\n\n## Task-Specific Guidance (${type})\n${additions}`;
    },

    /**
     * Get all recognized task types.
     */
    getTaskTypes() {
      return Object.keys(TASK_PATTERNS);
    },

    /**
     * Get pattern details for a specific task type.
     */
    getPattern(type) {
      return TASK_PATTERNS[type] || null;
    },
  };
}
