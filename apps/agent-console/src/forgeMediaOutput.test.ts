import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { ForgeAudioOutputError, prepareForgeAudioOutput, saveForgeAudioOutput } from "./forgeMediaOutput.ts";

const audio = Uint8Array.from({ length: 64 }, (_, index) => index);
const hash = createHash("sha256").update(audio).digest("hex");
async function directory(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forge-audio-output-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^forge-audio-output-/u);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}
function failed(fileCreated = false, outcomeUnknown = false) {
  return (error: unknown) => {
    assert.ok(error instanceof ForgeAudioOutputError); assert.equal(error.saved, false);
    assert.equal(error.fileCreated, fileCreated); assert.equal(error.outcomeUnknown, outcomeUnknown);
    assert.equal(error.retrySafe, false); assert.equal(error.retryable, false); return true;
  };
}

test("Forge audio saves a new Chinese-named file and verifies the original handle from position zero", async t => {
  const root = await directory(t), userPath = path.join(root, "中文语音.wav"), target = await prepareForgeAudioOutput(userPath);
  const opened: { flags: string; positions: (number | bigint | null | undefined)[] }[] = [];
  const open = fs.open.bind(fs);
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args), positions: (number | bigint | null | undefined)[] = [];
    opened.push({ flags: String(args[1]), positions }); const read = handle.read.bind(handle);
    handle.read = ((...readArgs: any[]) => { positions.push(readArgs[3]); return (read as any)(...readArgs); }) as typeof handle.read;
    return handle;
  });
  assert.deepEqual(await saveForgeAudioOutput(target, audio, hash), { status: "saved", path: target.path, bytes: audio.length, sha256: hash });
  assert.deepEqual(await fs.readFile(userPath), Buffer.from(audio)); assert.deepEqual(opened, [{ flags: "wx+", positions: [0] }]);
  await assert.rejects(saveForgeAudioOutput(target, audio, hash), failed());
});

test("Forge audio never opens or changes an existing target, including one created after prepare", async t => {
  const root = await directory(t), userPath = path.join(root, "existing.wav"), original = Buffer.from("user-owned existing content");
  await fs.writeFile(userPath, original);
  await assert.rejects(prepareForgeAudioOutput(userPath), failed()); assert.deepEqual(await fs.readFile(userPath), original);
  const racing = path.join(root, "racing.wav"), target = await prepareForgeAudioOutput(racing);
  await fs.writeFile(racing, original); await assert.rejects(saveForgeAudioOutput(target, audio, hash), failed());
  assert.deepEqual(await fs.readFile(racing), original);
});

test("Forge audio rejects bad paths without creating a parent or a file", async t => {
  const root = await directory(t);
  for (const input of ["CON.wav", "aux.wav", "COM1.wav", "COM¹.wav", "NUL.txt.wav", "file.wav:stream", "file.wav ",
    "voice.mp3", "voice\u0000.wav", "voice\u001b.wav", "C:relative.wav", "\\\\server\\share\\voice.wav", "\\\\?\\C:\\voice.wav", "http://host/voice.wav"]) {
    const candidate = input.includes(":") || input.startsWith("\\\\") ? input : path.join(root, input);
    await assert.rejects(prepareForgeAudioOutput(candidate), failed());
  }
  await assert.rejects(prepareForgeAudioOutput(path.join(root, "missing", "voice.wav")), failed());
  assert.deepEqual(await fs.readdir(root), []);
});

test("Forge audio rejects forged targets, bad hashes and oversize bytes before file creation", async t => {
  const root = await directory(t), userPath = path.join(root, "voice.wav");
  await assert.rejects(saveForgeAudioOutput({ path: userPath }, audio, hash), failed());
  await assert.rejects(saveForgeAudioOutput(await prepareForgeAudioOutput(userPath), audio, "0".repeat(64)), failed());
  await assert.rejects(saveForgeAudioOutput(await prepareForgeAudioOutput(userPath), new Uint8Array(4 * 1024 * 1024 + 1), hash), failed());
  assert.deepEqual(await fs.readdir(root), []);
});

test("Forge audio detects a replaced parent and leaves the replacement empty", async t => {
  const root = await directory(t), parent = path.join(root, "parent"); await fs.mkdir(parent);
  const target = await prepareForgeAudioOutput(path.join(parent, "voice.wav"));
  await fs.rename(parent, path.join(root, "old-parent")); await fs.mkdir(parent);
  await assert.rejects(saveForgeAudioOutput(target, audio, hash), failed()); assert.deepEqual(await fs.readdir(parent), []);
});

test("Forge audio copies caller bytes before asynchronous checks", async t => {
  const root = await directory(t), target = await prepareForgeAudioOutput(path.join(root, "voice.wav")), callerBytes = new Uint8Array(audio);
  const promise = saveForgeAudioOutput(target, callerBytes, hash); callerBytes.fill(0);
  await promise; assert.deepEqual(await fs.readFile(target.path), Buffer.from(audio));
});

test("Forge audio retains a partial newly created file when writing fails and reports uncertainty", async t => {
  const root = await directory(t), target = await prepareForgeAudioOutput(path.join(root, "voice.wav")), open = fs.open.bind(fs);
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args);
    handle.writeFile = async () => { await handle.write(audio.subarray(0, 8)); throw Object.assign(new Error("simulated full disk"), { code: "ENOSPC" }); };
    return handle;
  });
  await assert.rejects(saveForgeAudioOutput(target, audio, hash), failed(true, true));
  assert.deepEqual(await fs.readFile(target.path), Buffer.from(audio.subarray(0, 8)));
});

test("Forge audio detects readback corruption and retains the new file for local inspection", async t => {
  const root = await directory(t), target = await prepareForgeAudioOutput(path.join(root, "voice.wav")), open = fs.open.bind(fs);
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args), sync = handle.sync.bind(handle);
    handle.sync = async () => { await handle.write(new Uint8Array([255]), 0, 1, 0); await sync(); }; return handle;
  });
  await assert.rejects(saveForgeAudioOutput(target, audio, hash), failed(true, true)); assert.equal((await fs.stat(target.path)).size, audio.length);
});

test("Forge audio refuses saved status when the newly created file gains another hard link", async t => {
  const root = await directory(t), target = await prepareForgeAudioOutput(path.join(root, "voice.wav")), open = fs.open.bind(fs);
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args), sync = handle.sync.bind(handle);
    handle.sync = async () => { await sync(); await fs.link(target.path, path.join(root, "linked.wav")); }; return handle;
  });
  await assert.rejects(saveForgeAudioOutput(target, audio, hash), failed(true, true)); assert.equal((await fs.stat(target.path)).nlink, 2);
});
