#!/usr/bin/env node
/**
 * Demo: Pure File Writer — Write files with ZERO side effects.
 *
 * Run:  node src/pure-fs/demo.js
 */

const { createPureFileSystem } = require('./pure-writer');
const fs = require('fs');

console.log('═══════════════════════════════════════════════════');
console.log('  Pure File Writer — Zero Side Effects Demo');
console.log('═══════════════════════════════════════════════════\n');

// Create a virtual filesystem
const vfs = createPureFileSystem();

// "Write" some files — nothing touches the disk
console.log('📝 Writing files (in memory only)...\n');

const r1 = vfs.writeFile('/config/database.json', JSON.stringify({
  host: 'localhost',
  port: 5432,
  name: 'mydb',
}, null, 2));

const r2 = vfs.writeFile('/logs/app.log', [
  '[2025-01-01 00:00:00] INFO  Server started',
  '[2025-01-01 00:00:01] INFO  Connected to database',
  '[2025-01-01 00:01:00] WARN  Slow query detected',
].join('\n'));

const r3 = vfs.writeFile('/data/output.txt', 'Hello from the pure writer!');

console.log('   Result:', r1);
console.log('   Result:', r2);
console.log('   Result:', r3);

// Read them back
console.log('\n📖 Reading files back from the virtual FS...\n');
console.log('   /config/database.json:');
console.log('  ', vfs.readFile('/config/database.json').split('\n').join('\n    '));
console.log('\n   /logs/app.log:');
console.log('  ', vfs.readFile('/logs/app.log').split('\n').join('\n    '));
console.log('\n   /data/output.txt:', vfs.readFile('/data/output.txt'));

// List all files
console.log('\n📂 All virtual files:', vfs.listFiles());

// Prove the disk was never touched
const tempPath = './config';
console.log('\n🔍 Disk check:');
console.log(`   Does "./config" exist on disk? ${fs.existsSync(tempPath)}`);
console.log(`   Does "/config/database.json" exist on disk? ${fs.existsSync('/config/database.json')}`);
console.log('   ✓ The filesystem is completely untouched!\n');

// Show isolation
console.log('🔒 Isolation demo — two independent virtual filesystems:\n');
const vfs2 = createPureFileSystem();
vfs2.writeFile('/data/output.txt', 'Different content in vfs2!');
console.log('   vfs1 reads:', JSON.stringify(vfs.readFile('/data/output.txt')));
console.log('   vfs2 reads:', JSON.stringify(vfs2.readFile('/data/output.txt')));
console.log('   ✓ They are fully independent.\n');

console.log('═══════════════════════════════════════════════════');
console.log('  Summary: write + read with ZERO disk I/O');
console.log('═══════════════════════════════════════════════════');
