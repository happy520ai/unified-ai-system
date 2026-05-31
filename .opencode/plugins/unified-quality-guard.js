// Local OpenCode plugin: last-line guard against dangerous shell/edit patterns.
// It intentionally does NOT inspect secrets and does NOT call external services.

const DENY_BASH = [
  /(^|\s)git\s+commit\b/i,
  /(^|\s)git\s+push\b/i,
  /(^|\s)git\s+reset\b/i,
  /(^|\s)git\s+clean\b/i,
  /(^|\s)(npm|pnpm)\s+publish\b/i,
  /(^|\s)(rm\s+-rf|Remove-Item\b.*-Recurse|del\b|rmdir\b)/i,
  /deploy/i,
  /release/i,
  /\.env(\.|\s|$)/i,
  /PROJECT_CONTEXT\.md/i,
  /(^|[\\/])legacy([\\/]|$)/i
];

const DENY_EDIT_PATH = [
  /(^|[\\/])legacy([\\/]|$)/i,
  /(^|[\\/])PROJECT_CONTEXT\.md$/i,
  /(^|[\\/])\.env(\..*)?$/i,
  /(^|[\\/])\.git([\\/]|$)/i,
  /(^|[\\/])node_modules([\\/]|$)/i,
  /(^|[\\/])(dist|build)([\\/]|$)/i
];

function stringify(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function assertAllowed(kind, text, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      throw new Error(`[unified-quality-guard] blocked ${kind}: matched ${pattern}`);
    }
  }
}

export const UnifiedQualityGuard = async () => {
  return {
    'tool.execute.before': async (input, output) => {
      const tool = String(input?.tool || '').toLowerCase();
      const args = output?.args || input?.args || {};

      if (tool === 'bash') {
        const command = stringify(args.command || args.cmd || args);
        assertAllowed('bash command', command, DENY_BASH);
      }

      if (tool === 'write' || tool === 'edit' || tool === 'apply_patch') {
        const payload = stringify(args);
        assertAllowed('edit target', payload, DENY_EDIT_PATH);
      }
    }
  };
};
