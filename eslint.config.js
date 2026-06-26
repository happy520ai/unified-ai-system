/**
 * ESLint configuration for unified-ai-system
 *
 * Flat config format (ESLint 9+)
 */
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "legacy/**",
      "**/*.test.js",
      "apps/ai-gateway-service/src/ui/scripts/**",
      "apps/ai-gateway-service/src/ui/styles/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        queueMicrotask: "readonly",
        performance: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        // Browser globals (for frontend code)
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        WebSocket: "readonly",
        Image: "readonly",
      },
    },
    rules: {
      // Error prevention
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-constant-condition": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-debugger": "warn",

      // Best practices
      "eqeqeq": ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "warn",
      "no-throw-literal": "error",
      "no-useless-concat": "warn",
      "no-useless-return": "warn",
      "prefer-const": "warn",
      "prefer-template": "warn",

      // Style (minimal, let formatter handle)
      "no-trailing-spaces": "warn",
      "no-multiple-empty-lines": ["warn", { max: 2 }],
    },
  },
];
