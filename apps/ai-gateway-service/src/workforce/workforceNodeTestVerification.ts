import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { GovernedAgentTaskVerificationResult } from "../agentic/governedAgentTaskProfile.ts";

type Counts = Readonly<Record<"tests" | "passed" | "failed" | "cancelled" | "skipped" | "todo" | "suites" | "topLevel", number>>;
type CheckStatus = "passed" | "failed" | "skipped" | "todo" | "missing" | "ambiguous";
export type NodeTestCheckResult = Readonly<{
  version: 1; adapter: "node-test"; contractHash: string; runnerHash: string; snapshotHash: string;
  verdict: "passed" | "failed";
  reason: "checks-passed" | "checks-failed" | "no-executed-checks" | "required-check-not-passed" | "incomplete-report";
  counts: Counts; executedPassed: number;
  requiredChecks: readonly Readonly<{ file: string; name: string; status: CheckStatus }>[];
}>;
const COUNT_KEYS = ["tests", "passed", "failed", "cancelled", "skipped", "todo", "suites", "topLevel"] as const;
const FRAME = "UAI_NODE_TEST_RECEIPT_V1:";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const hash = (value: unknown) => "sha256:" + digest(stableStringify(value));

// The fixed supervisor runs inside the existing container, never on the host.
// Only it receives the one-run authenticator on stdin. Test descendants produce
// TestsStream events; their stdout/stderr are escaped diagnostics, not receipts.
const RUNNER = String.raw`import { run } from 'node:test';
import { createHmac } from 'node:crypto';
import { closeSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const pieces=[]; let size=0;
for await (const chunk of process.stdin) { size+=chunk.length; if(size>65536) throw Error('input limit'); pieces.push(chunk); }
const input=JSON.parse(Buffer.concat(pieces).toString('utf8')); pieces.length=0;
process.stdin.destroy(); try { closeSync(0); } catch {}
const files=input.files.map(file=>resolve(file)), allowed=new Set(files);
const identity=data=>JSON.stringify([data.file,data.line,data.column]);
const nonLeaves=new Set(), observations=[], summaries=new Map();
let aggregate=null, aggregateCount=0, events=0, complete=true;
const countsKeys=['tests','passed','failed','cancelled','skipped','todo','suites','topLevel'];
const countsOf=data=>Object.fromEntries(countsKeys.map(key=>[key,data[key]]));
const diagnostics=(type,data)=>process.stdout.write('[node-test '+type+'] '+JSON.stringify(data)+'\n');
try {
  for await (const {type,data} of run({files,isolation:'process',concurrency:1,watch:false})) {
    if(++events>100000) throw Error('event limit');
    if(type==='test:plan' && data.file && data.count>0) nonLeaves.add(identity(data));
    if(type==='test:pass' || type==='test:fail') {
      if(observations.length>=10000) throw Error('check limit');
      observations.push({key:identity(data),file:data.file,name:data.name,line:data.line,
        kind:data.details?.type,status:data.todo!==undefined?'todo':data.skip!==undefined?'skipped':type==='test:pass'?'passed':'failed'});
      diagnostics(type,{file:data.file,name:data.name,status:observations.at(-1).status,
        ...(data.details?.error ? {error:String(data.details.error.message??data.details.error)} : {})});
    }
    if(type==='test:stdout' || type==='test:stderr' || type==='test:diagnostic') diagnostics(type,data);
    if(type==='test:summary') {
      if(data.file===undefined) { aggregateCount++; aggregate={success:data.success,counts:countsOf(data.counts)}; }
      else if(allowed.has(data.file)) { if(summaries.has(data.file)) complete=false; summaries.set(data.file,data); }
    }
  }
} catch(error) { complete=false; diagnostics('runner-error',String(error.message??error)); }
complete=complete && aggregateCount===1 && files.every(file=>summaries.has(file));
const leaves=observations.filter(item=>allowed.has(item.file) && item.kind==='test' && Number.isSafeInteger(item.line)
  && item.line>0 && !nonLeaves.has(item.key) && summaries.get(item.file)?.counts?.tests>0
  && item.name!==item.file && item.name!==relative(process.cwd(),item.file));
const checks=input.contract.requiredChecks.map(check=>{
  const matches=leaves.filter(item=>item.file===resolve(check.file) && item.name===check.name);
  return {...check,status:matches.length===0?'missing':matches.length>1?'ambiguous':matches[0].status};
});
const report={version:1,nonce:input.nonce,contractHash:input.contractHash,runnerHash:input.runnerHash,snapshotHash:input.snapshotHash,
  complete,success:aggregate?.success===true,counts:aggregate?.counts??Object.fromEntries(countsKeys.map(key=>[key,0])),
  executedPassed:leaves.filter(item=>item.status==='passed').length,requiredChecks:checks};
const payload=Buffer.from(JSON.stringify(report)).toString('base64');
const mac=createHmac('sha256',Buffer.from(input.key,'hex')).update(payload).digest('hex');
process.stdout.write('UAI_NODE_TEST_RECEIPT_V1:'+payload+':'+mac+'\n');
process.exitCode=aggregate?.success===true ? 0 : 1;
`;
export const NODE_TEST_RUNNER_HASH = "sha256:" + digest(RUNNER);

/** Budget the mandatory report and named-check diagnostics before any execution. */
export function nodeTestMinimumOutputBytes(contract: GovernedAgentTaskVerificationResult): number {
  const requiredChecks = contract.requiredChecks.map(check => ({ ...check, status: "ambiguous" }));
  const report = { version: 1, nonce: "f".repeat(32), contractHash: "sha256:" + "f".repeat(64), runnerHash: NODE_TEST_RUNNER_HASH,
    snapshotHash: "f".repeat(64), complete: false, success: false,
    counts: Object.fromEntries(COUNT_KEYS.map(key => [key, 10000])), executedPassed: 10000, requiredChecks };
  const frame = FRAME.length + 4 * Math.ceil(Buffer.byteLength(JSON.stringify(report)) / 3) + 1 + 64 + 1;
  const diagnostics = requiredChecks.reduce((total, check) => total + Buffer.byteLength("[node-test test:pass] "
    + JSON.stringify({ file: "/workspace/" + check.file, name: check.name, status: "skipped" }) + "\n"), 0);
  return frame + diagnostics + 1024;
}

function invalid(): never {
  throw Object.assign(new Error("The structured Node test verification receipt is invalid or incomplete."), {
    code: "WORKFORCE_NODE_TEST_RECEIPT_INVALID",
  });
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== keys.length) invalid();
  for (const key of keys) { const field = Object.getOwnPropertyDescriptor(value, key); if (!field?.enumerable || !("value" in field)) invalid(); }
  return value as Record<string, unknown>;
}
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 10000;
function facts(value: Record<string, unknown>, contract: GovernedAgentTaskVerificationResult) {
  const counts = record(value.counts, COUNT_KEYS);
  if (!COUNT_KEYS.every(key => integer(counts[key])) || !integer(value.executedPassed)
    || counts.tests !== ["passed", "failed", "cancelled", "skipped", "todo"].reduce((total, key) => total + Number(counts[key]), 0)
    || Number(counts.topLevel) > Number(counts.tests) + Number(counts.suites)
    || Number(value.executedPassed) > Number(counts.passed) || !Array.isArray(value.requiredChecks)
    || value.requiredChecks.length !== contract.requiredChecks.length) invalid();
  const requiredChecks = value.requiredChecks.map((item, index) => {
    const check = record(item, ["file", "name", "status"]), expected = contract.requiredChecks[index]!;
    if (check.file !== expected.file || check.name !== expected.name
      || !["passed", "failed", "skipped", "todo", "missing", "ambiguous"].includes(String(check.status))) invalid();
    return Object.freeze({ file: expected.file, name: expected.name, status: check.status as CheckStatus });
  });
  if (requiredChecks.filter(check => check.status === "passed").length > Number(value.executedPassed)) invalid();
  return { counts: Object.freeze(counts) as Counts, executedPassed: Number(value.executedPassed), requiredChecks: Object.freeze(requiredChecks) };
}
function reasonFor(value: ReturnType<typeof facts>, contract: GovernedAgentTaskVerificationResult, exitCode: number,
  complete = true, success = true): NodeTestCheckResult["reason"] {
  if (!complete) return "incomplete-report";
  if (exitCode !== 0 || !success || value.counts.failed || value.counts.cancelled) return "checks-failed";
  if (value.executedPassed < contract.minimumPassed) return "no-executed-checks";
  if (value.requiredChecks.some(check => check.status !== "passed")) return "required-check-not-passed";
  return "checks-passed";
}

/** Revalidates durable facts inside the already authenticated original task record. */
export function validateNodeTestCheckResult(value: unknown, contract: GovernedAgentTaskVerificationResult, snapshotHash: string,
  exitCode: number): NodeTestCheckResult {
  const source = record(value, ["version", "adapter", "contractHash", "runnerHash", "snapshotHash", "verdict", "reason", "counts", "executedPassed", "requiredChecks"]);
  if (source.version !== 1 || source.adapter !== "node-test" || source.contractHash !== hash(contract)
    || source.runnerHash !== NODE_TEST_RUNNER_HASH || source.snapshotHash !== snapshotHash || !/^[a-f0-9]{64}$/u.test(snapshotHash)
    || !Number.isSafeInteger(exitCode) || exitCode < 0) invalid();
  const checked = facts(source, contract);
  // Incomplete reports always fail. A completed report's reason is derived from
  // its actual exit and check facts, including an exit-zero validation failure.
  const reason = reasonFor(checked, contract, exitCode, source.reason !== "incomplete-report");
  if (source.reason !== reason || source.verdict !== (reason === "checks-passed" ? "passed" : "failed")) invalid();
  return Object.freeze({ version: 1, adapter: "node-test", contractHash: hash(contract), runnerHash: NODE_TEST_RUNNER_HASH,
    snapshotHash, verdict: reason === "checks-passed" ? "passed" : "failed", reason, ...checked });
}

/** Ephemeral preparation; the key exists only in the trusted parent's input pipe. */
export function prepareNodeTestVerification(contract: GovernedAgentTaskVerificationResult, files: readonly string[], snapshotHash: string) {
  const key = randomBytes(32), nonce = randomBytes(16).toString("hex"), contractHash = hash(contract);
  const input = JSON.stringify({ key: key.toString("hex"), nonce, contract, files, contractHash, runnerHash: NODE_TEST_RUNNER_HASH, snapshotHash });
  if (Buffer.byteLength(input) > 65536) invalid();
  const command = "umask 077; printf '%s' '" + Buffer.from(RUNNER).toString("base64")
    + "' | base64 -d > /scratch/uai-node-check.mjs && exec node /scratch/uai-node-check.mjs";
  let consumed = false;
  return Object.freeze({ command, stdin: input,
    read(stdout: string, exitCode: number) {
      if (consumed) invalid(); consumed = true;
      try {
        const lines = stdout.split("\n"), frames = lines.filter(line => line.startsWith(FRAME));
        if (frames.length !== 1 || frames[0]!.length > 65536) invalid();
        const match = /^UAI_NODE_TEST_RECEIPT_V1:([A-Za-z0-9+/]+={0,2}):([a-f0-9]{64})$/u.exec(frames[0]!);
        if (!match || !timingSafeEqual(createHmac("sha256", key).update(match[1]!).digest(), Buffer.from(match[2]!, "hex"))) invalid();
        const data = record(JSON.parse(Buffer.from(match[1]!, "base64").toString("utf8")),
          ["version", "nonce", "contractHash", "runnerHash", "snapshotHash", "complete", "success", "counts", "executedPassed", "requiredChecks"]);
        if (data.version !== 1 || data.nonce !== nonce || data.contractHash !== contractHash || data.runnerHash !== NODE_TEST_RUNNER_HASH
          || data.snapshotHash !== snapshotHash || typeof data.complete !== "boolean" || typeof data.success !== "boolean") invalid();
        const checked = facts(data, contract), reason = reasonFor(checked, contract, exitCode, data.complete, data.success);
        const checkResult: NodeTestCheckResult = Object.freeze({ version: 1, adapter: "node-test", contractHash, runnerHash: NODE_TEST_RUNNER_HASH,
          snapshotHash, verdict: reason === "checks-passed" ? "passed" : "failed", reason, ...checked });
        // A complete Node summary must agree with the runner's real exit status.
        if (data.complete && data.success !== (exitCode === 0)) invalid();
        validateNodeTestCheckResult(checkResult, contract, snapshotHash, exitCode);
        return { checkResult, stdout: lines.filter(line => !line.startsWith(FRAME)).join("\n") };
      } finally { key.fill(0); }
    },
    close() { key.fill(0); consumed = true; },
  });
}
