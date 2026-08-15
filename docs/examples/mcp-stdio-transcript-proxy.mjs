#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const separatorIndex = process.argv.indexOf("--");
const evidenceIndex = process.argv.indexOf("--evidence");
if (evidenceIndex < 0 || !process.argv[evidenceIndex + 1]) {
  throw new Error("Expected --evidence <path>.");
}
const serverCommandIndex = separatorIndex >= 0
  ? separatorIndex + 1
  : evidenceIndex + 2;
if (!process.argv[serverCommandIndex]) {
  throw new Error("Expected [--] <server-command> [server-args...].");
}

const evidencePath = resolve(process.argv[evidenceIndex + 1]);
const serverCommand = process.argv[serverCommandIndex];
const serverArguments = process.argv.slice(serverCommandIndex + 1);
const pendingMethods = new Map();
const hostMethods = new Set();
const toolCallNames = new Set();
let hostBuffer = "";
let serverBuffer = "";

const evidence = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  clientInfo: null,
  serverInfo: null,
  requestedProtocolVersion: null,
  negotiatedProtocolVersion: null,
  hostMethods: [],
  toolNames: [],
  toolCallNames: [],
  initialized: false,
  toolsListRequested: false,
  parseErrors: 0,
  serverPid: null,
  serverExitCode: null,
  serverSignal: null,
  serverError: null,
  hostInputClosed: false,
  completed: false,
};

function messageIdKey(id) {
  return `${typeof id}:${String(id)}`;
}

function publicPeerInfo(value) {
  if (!value || typeof value !== "object") return null;
  return {
    name: typeof value.name === "string" ? value.name : null,
    version: typeof value.version === "string" ? value.version : null,
  };
}

function persistEvidence() {
  evidence.hostMethods = [...hostMethods].sort();
  evidence.toolCallNames = [...toolCallNames].sort();
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function recordHostMessage(message) {
  if (!message || typeof message !== "object" || typeof message.method !== "string") return;
  hostMethods.add(message.method);
  if (message.id !== undefined) {
    pendingMethods.set(messageIdKey(message.id), message.method);
  }
  if (message.method === "initialize") {
    evidence.clientInfo = publicPeerInfo(message.params?.clientInfo);
    evidence.requestedProtocolVersion = message.params?.protocolVersion ?? null;
  } else if (message.method === "notifications/initialized") {
    evidence.initialized = true;
  } else if (message.method === "tools/list") {
    evidence.toolsListRequested = true;
  } else if (message.method === "tools/call" && typeof message.params?.name === "string") {
    toolCallNames.add(message.params.name);
  }
  persistEvidence();
}

function recordServerMessage(message) {
  if (!message || typeof message !== "object" || message.id === undefined) return;
  const key = messageIdKey(message.id);
  const method = pendingMethods.get(key);
  if (!method) return;
  pendingMethods.delete(key);
  if (method === "initialize" && message.result) {
    evidence.serverInfo = publicPeerInfo(message.result.serverInfo);
    evidence.negotiatedProtocolVersion = message.result.protocolVersion ?? null;
  } else if (method === "tools/list" && Array.isArray(message.result?.tools)) {
    evidence.toolNames = message.result.tools
      .map((tool) => tool?.name)
      .filter((name) => typeof name === "string")
      .sort();
  }
  persistEvidence();
}

function consumeLines(direction, chunk) {
  const bufferName = direction === "host" ? "hostBuffer" : "serverBuffer";
  let value = (bufferName === "hostBuffer" ? hostBuffer : serverBuffer) + chunk.toString("utf8");
  const lines = value.split(/\r?\n/);
  value = lines.pop() ?? "";
  if (bufferName === "hostBuffer") hostBuffer = value;
  else serverBuffer = value;

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      if (direction === "host") recordHostMessage(message);
      else recordServerMessage(message);
    } catch {
      evidence.parseErrors += 1;
      persistEvidence();
    }
  }
}

const child = spawn(serverCommand, serverArguments, {
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});
evidence.serverPid = child.pid ?? null;
persistEvidence();
child.stdin.on("error", () => {});

process.stdin.on("data", (chunk) => {
  consumeLines("host", chunk);
  if (!child.stdin.destroyed) child.stdin.write(chunk);
});
process.stdin.on("end", () => {
  evidence.hostInputClosed = true;
  persistEvidence();
  if (!child.stdin.destroyed) child.stdin.end();
});
process.stdin.on("error", () => {
  if (!child.stdin.destroyed) child.stdin.end();
});

child.stdout.on("data", (chunk) => {
  consumeLines("server", chunk);
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});
child.on("error", (error) => {
  evidence.serverError = error instanceof Error ? error.message : String(error);
  persistEvidence();
});
child.on("exit", (code, signal) => {
  evidence.serverExitCode = code;
  evidence.serverSignal = signal;
  evidence.completed = true;
  persistEvidence();
  process.exitCode = code ?? 0;
});

function stopChild(signal) {
  evidence.serverSignal = signal;
  persistEvidence();
  if (child.exitCode === null && child.signalCode === null) child.kill();
}

process.on("SIGINT", () => stopChild("SIGINT"));
process.on("SIGTERM", () => stopChild("SIGTERM"));
process.on("exit", persistEvidence);
