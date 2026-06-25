/**
 * Forge runner script — sets env vars and runs forge CLI.
 * Avoids Windows batch encoding issues with Chinese paths.
 */

if (!process.env.MIMO_API_KEY) {
  console.warn('[forge] Warning: MIMO_API_KEY not set. Please set it in your environment.');
  process.exit(1);
}
process.env.FORGE_PROJECT_ROOT = process.env.FORGE_PROJECT_ROOT || 'E:\\AI-Data\\AI\u7F51\u5173\u7CFB\u7EDF\\unified-ai-system\\packages\\forge-core\\test-project-v2';
process.env.FORGE_MAX_CONCURRENT = process.env.FORGE_MAX_CONCURRENT || '1';
process.env.FORGE_CODE_INTEL = process.env.FORGE_CODE_INTEL || 'false';

// Change to forge-core directory
process.chdir('E:\\AI-Data\\AI\u7F51\u5173\u7CFB\u7EDF\\unified-ai-system\\packages\\forge-core');

// Simulate CLI args: forge run "..."
process.argv = [
  process.execPath,
  'bin/forge.js',
  'run',
  'Add a request logging middleware that logs HTTP method, path, status code and response time for every request. Create the middleware in src/middleware/requestLogger.js and integrate it into src/server.js. Write unit tests in test/requestLogger.test.js',
];

// Load the CLI
import('./bin/forge.js');
