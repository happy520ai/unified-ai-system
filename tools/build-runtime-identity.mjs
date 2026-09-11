import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRuntimeIdentityManifest,
  inspectRuntimeBuildIdentity,
  RUNTIME_IDENTITY_PATH,
} from "../apps/ai-gateway-service/src/application/runtimeBuildIdentity.ts";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const args = process.argv.slice(2);
try {
  if (args[0] === "--verify") {
    const containerReadonly = args[args.length - 1] === "--container-readonly";
    const remainder = containerReadonly ? args.slice(0, -1) : args;
    if (remainder.length !== 1 && !(remainder.length === 3 && remainder[1] === "--expect-revision" && /^[a-f0-9]{40}$/u.test(remainder[2]))) throw new Error("RUNTIME_IDENTITY_ARGUMENT_INVALID");
    // --container-readonly admits exported-layer hard links on a read-only
    // root filesystem only; every digest and inode check still applies.
    const identity = inspectRuntimeBuildIdentity(root, { allowHardlinkedInputs: containerReadonly });
    if (identity.status !== "verified") {
      throw Object.assign(new Error("RUNTIME_IDENTITY_NOT_VERIFIED"), { code: `RUNTIME_IDENTITY_${identity.reason.replace(/-/g, "_").toUpperCase()}` });
    }
    if (remainder.length === 3 && identity.declaredRevision !== remainder[2]) throw new Error("RUNTIME_IDENTITY_DECLARED_REVISION_MISMATCH");
    process.stdout.write(JSON.stringify({ identity, expectedDeclaredRevision: remainder[2] ?? null, containerReadonly }, null, 2) + "\n");
  } else {
    if (args.length !== 0 && !(args.length === 2 && args[0] === "--declared-revision"
      && (args[1] === "" || /^[a-f0-9]{40}$/u.test(args[1])))) throw new Error("RUNTIME_IDENTITY_ARGUMENT_INVALID");
    const manifest = createRuntimeIdentityManifest(root, args[1] || null);
    publishManifest(manifest);
    process.stdout.write(JSON.stringify({ manifest, output: RUNTIME_IDENTITY_PATH }, null, 2) + "\n");
  }
} catch (error) {
  // Fixed source/manifest paths only. Never print filesystem errors or contents;
  // the stable error code is enough to route the failure.
  process.stderr.write(`Runtime identity build or verification failed; no identity was accepted. (${String(error?.code ?? "UNKNOWN")})\n`);
  process.exitCode = 1;
}

function publishManifest(manifest) {
  const target = resolve(root, RUNTIME_IDENTITY_PATH);
  const directory = dirname(target);
  try { mkdirSync(directory, { mode: 0o755 }); }
  catch (error) { if (error?.code !== "EEXIST") throw error; }
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory) !== directory) throw new Error("RUNTIME_IDENTITY_OUTPUT_UNSAFE");
  const temporary = resolve(directory, ".runtime-identity-" + randomBytes(12).toString("hex") + ".tmp");
  const file = openSync(temporary, "wx", 0o644);
  try {
    writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
    fsyncSync(file);
    // Atomic create, never overwrite a pre-existing artifact or user file.
    linkSync(temporary, target);
  } finally {
    closeSync(file);
    unlinkSync(temporary);
  }
}
