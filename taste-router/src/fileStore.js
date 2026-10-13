// Tiny JSON-file cache for local development so repeated runs don't burn the monthly Qloo quota.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export function fileStore(dir = '.cache') {
  const f = k => `${dir}/${createHash('sha1').update(k).digest('hex')}.json`;
  return {
    async get(k) { try { return JSON.parse(await readFile(f(k), 'utf8')); } catch { return null; } },
    async put(k, v) { await mkdir(dir, { recursive: true }); await writeFile(f(k), JSON.stringify(v)); },
  };
}
