import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  findTarMember,
  isGzip,
  pickAmd64Child,
  rosterFromSource,
  ROSTER_MEMBER_SUFFIX,
} from './verify-image-roster.mjs';

const ROSTER = [
  'gateway_health', 'gateway_readiness', 'agent_governance_status', 'agent_governance_list',
  'agent_governance_describe', 'gateway_prompt_enhance', 'gateway_prompt_enhance_llm',
  'gateway_chat', 'knowledge_readiness', 'knowledge_retrieve', 'workflow_health',
  'workflow_actions', 'workflow_run', 'workforce_health', 'workforce_agents',
];

function sourceWith(names, tail = '') {
  return [
    'export const MCP_SERVER_VERSION = "0.8.0";',
    'export const MCP_TOOL_NAMES = Object.freeze([',
    ...names.map((name) => `  "${name}",`),
    ']);',
    tail,
  ].join('\n');
}

test('rosterFromSource reads the real source file and counts 15', () => {
  const names = rosterFromSource(readFileSync('packages/mcp-server/src/server.js', 'utf8'));
  assert.equal(names.length, 15);
  assert.deepEqual(names, ROSTER);
});

// The defect this guard exists to prevent: a parser that scans everything after the marker
// keeps consuming quoted strings from the rest of the file and reported "73 tools" for the
// same image that the bounded parser reads as 15. Boundary, not preference.
test('rosterFromSource stops at the array close and ignores later strings', () => {
  const trailing = sourceWith(ROSTER, [
    'export const PROFILES = Object.freeze(["general", "coding", "analysis"]);',
    'const MODE = "fake";',
    'export const THING = { kind: "text", mode: "real" };',
  ].join('\n'));
  assert.deepEqual(rosterFromSource(trailing), ROSTER);
  const unbounded = trailing.slice(trailing.indexOf('MCP_TOOL_NAMES'));
  const greedy = [...unbounded.matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
  assert.ok(greedy.length > ROSTER.length, 'the greedy reading must differ, or this arm tests nothing');
});

test('rosterFromSource reports blindness as null, never as zero', () => {
  assert.equal(rosterFromSource('export const OTHER = [];'), null);
  assert.equal(rosterFromSource('MCP_TOOL_NAMES = Object.freeze(["a",'), null);
  assert.equal(rosterFromSource(undefined), null);
  assert.equal(rosterFromSource(sourceWith([])), null);
});

test('rosterFromSource drops one name when one name is removed', () => {
  const names = rosterFromSource(sourceWith(ROSTER.filter((n) => n !== 'workflow_run')));
  assert.equal(names.length, 14);
  assert.ok(!names.includes('workflow_run'));
});

const index = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [
    { digest: 'sha256:aaa', platform: { architecture: 'amd64', os: 'linux' }, size: 4280 },
    { digest: 'sha256:bbb', platform: { architecture: 'arm64', os: 'linux' }, size: 4280 },
    { digest: 'sha256:ccc', platform: { architecture: 'unknown', os: 'unknown', variant: '' }, size: 1112 },
  ],
};

test('pickAmd64Child chooses the linux/amd64 image, not an attestation', () => {
  assert.equal(pickAmd64Child(index), 'sha256:aaa');
  assert.equal(pickAmd64Child({ manifests: [{ digest: 'sha256:ccc', platform: { architecture: 'unknown', os: 'unknown' } }] }), null);
  assert.equal(pickAmd64Child({}), null);
});

// A single real-file member plus end-of-archive, written by hand so the test does not lean
// on the implementation under test to build its own input.
function tarWith(fileName, content) {
  const payload = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512);
  Buffer.from(fileName, 'utf8').copy(header, 0, 0, 100);
  Buffer.from('0000644\0', 'utf8').copy(header, 100);
  Buffer.from(`${payload.length.toString(8).padStart(11, '0')}\0`, 'utf8').copy(header, 124);
  Buffer.from('00000000000\0', 'utf8').copy(header, 136);
  header[156] = 0x30; // '0' == regular file
  Buffer.from('ustar\0', 'utf8').copy(header, 257);
  Buffer.from('00', 'utf8').copy(header, 263);
  const padded = Buffer.alloc(Math.ceil(payload.length / 512) * 512);
  payload.copy(padded);
  return Buffer.concat([header, padded, Buffer.alloc(1024)]);
}

test('findTarMember returns the roster file and only that file', () => {
  const archive = tarWith('app/packages/mcp-server/src/server.js', sourceWith(ROSTER));
  const member = findTarMember(new Uint8Array(archive), ROSTER_MEMBER_SUFFIX);
  assert.equal(member.name, 'app/packages/mcp-server/src/server.js');
  // Uint8Array.toString('utf8') returns comma-joined bytes; a decoder that used it would
  // produce a name like "97,112,112,47..." and find nothing. Assert the text is text.
  assert.ok(member.text.includes('MCP_TOOL_NAMES'), 'payload must decode as UTF-8 text');
  assert.ok(!member.name.includes(','), 'name must decode as UTF-8 text');
  assert.deepEqual(rosterFromSource(member.text), ROSTER);
});

test('findTarMember returns null when the member is absent', () => {
  const archive = tarWith('app/packages/web-agent/dist/other.js', 'console.log(1);');
  assert.equal(findTarMember(new Uint8Array(archive), ROSTER_MEMBER_SUFFIX), null);
  assert.equal(findTarMember(new Uint8Array(Buffer.alloc(0)), ROSTER_MEMBER_SUFFIX), null);
});

test('isGzip separates a gzipped layer from a tar', () => {
  assert.equal(isGzip(new Uint8Array([0x1f, 0x8b, 0x08])), true);
  assert.equal(isGzip(new Uint8Array([0x00, 0x00, 0x00])), false);
  assert.equal(isGzip(new Uint8Array([0x1f])), false);
});

// A CLI whose entry guard never fires still imports fine, still passes every pure-function
// test, and prints nothing when run - which is exactly how it looked on Windows until this
// arm existed. Running it with no tag must be loud.
test('invoked as a script the CLI runs and refuses to guess a tag', () => {
  let failure = null;
  try {
    execFileSync(process.execPath, ['tools/verify-image-roster.mjs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, 'running with no tag must exit non-zero');
  assert.equal(failure.status, 1);
  assert.match(String(failure.stderr), /Usage: node tools\/verify-image-roster\.mjs/);
});

// Importing the module for its pure functions must not execute the CLI.
test('importing the module does not run main', () => {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import('./tools/verify-image-roster.mjs').then((m) => process.stdout.write(typeof m.fetchImageRoster));"],
  { encoding: 'utf8' });
  assert.equal(out.trim(), 'function');
});
