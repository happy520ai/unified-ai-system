#!/usr/bin/env node
/**
 * backup.mjs — Automated backup for AI Gateway data
 * Usage: node tools/backup.mjs [--data-dir=.data] [--output=backups]
 */
import { mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const DATA_DIR = process.argv.find(a => a.startsWith("--data-dir="))?.split("=")[1] ?? ".data";
const OUTPUT_DIR = process.argv.find(a => a.startsWith("--output="))?.split("=")[1] ?? "backups";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const BACKUP_DIR = join(OUTPUT_DIR, `backup-${TIMESTAMP}`);

const FILES_TO_BACKUP = [
  "repository.db",
  "workforce/plans.json",
  "capabilities/registry.json",
];

console.log(`\nBackup: ${DATA_DIR} → ${BACKUP_DIR}\n`);

mkdirSync(BACKUP_DIR, { recursive: true });

let backed = 0;
for (const file of FILES_TO_BACKUP) {
  const src = resolve(DATA_DIR, file);
  if (!existsSync(src)) {
    console.log(`  SKIP  ${file} (not found)`);
    continue;
  }
  const dest = resolve(BACKUP_DIR, file);
  mkdirSync(resolve(dest, ".."), { recursive: true });
  copyFileSync(src, dest);
  const size = statSync(src).size;
  console.log(`  OK    ${file} (${(size / 1024).toFixed(1)}KB)`);
  backed++;
}

console.log(`\nBackup complete: ${backed} files → ${BACKUP_DIR}\n`);
