import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CliUsageError,
  parseCliArgs,
} from "./cli-core.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const cliEntrypoint = resolve(currentDirectory, "cli.js");
const repoRoot = resolve(currentDirectory, "../../..");

test("parseCliArgs supports terminal commands and machine output", () => {
  const parsed = parseCliArgs(
    [
      "chat",
      "hello",
      "from",
      "the",
      "terminal",
      "--url",
      "http://127.0.0.1:43100",
      "--timeout=2500",
      "--json",
    ],
    {},
  );

  assert.equal(parsed.command, "chat");
  assert.equal(parsed.positionals.join(" "), "hello from the terminal");
  assert.equal(parsed.url, "http://127.0.0.1:43100");
  assert.equal(parsed.timeoutMs, 2500);
  assert.equal(parsed.json, true);
});

test("parseCliArgs supports prompt enhancement commands and profiles", () => {
  const preview = parseCliArgs([
    "enhance",
    "build",
    "an",
    "API",
    "--profile=coding",
  ], {});
  assert.equal(preview.command, "enhance");
  assert.equal(preview.positionals.join(" "), "build an API");
  assert.equal(preview.profile, "coding");

  const chat = parseCliArgs([
    "chat",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
  ], {});
  assert.equal(chat.enhance, true);
  assert.equal(chat.profile, "coding");
  assert.equal(chat.language, "zh-CN");

  const demo = parseCliArgs([
    "demo",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--evidence",
  ], {});
  assert.equal(demo.enhance, true);
  assert.equal(demo.profile, "coding");
  assert.equal(demo.evidence, true);

  const evidence = parseCliArgs([
    "enhance",
    "build an API",
    "--evidence",
  ], {});
  assert.equal(evidence.evidence, true);
});

test("parseCliArgs rejects ambiguous or unsafe option combinations", () => {
  assert.throws(
    () => parseCliArgs(["status", "--allow-real-provider"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with the chat"),
  );
  assert.throws(
    () => parseCliArgs(["chat", "hello", "--prompt", "world"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("either positional prompt"),
  );
  assert.throws(
    () => parseCliArgs(["serve", "--json"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("not supported by serve"),
  );
  assert.throws(
    () => parseCliArgs(["status", "--profile", "coding"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with enhance"),
  );
  assert.throws(
    () => parseCliArgs(["enhance", "hello", "--profile", "magic"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("Unsupported enhancement profile"),
  );
  assert.throws(
    () => parseCliArgs(["enhance", "hello", "--language", "fr"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("Unsupported enhancement language"),
  );
  assert.throws(
    () => parseCliArgs(["chat", "hello", "--evidence"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with the demo or enhance"),
  );
  assert.throws(
    () => parseCliArgs(["chat", "hello", "--language", "zh-CN"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with enhance"),
  );
});

test("status reports gateway readiness as JSON", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "status",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.status, "ready");
  assert.equal(output.providerMode, "fake");
  assert.equal(output.realProviderEnabled, false);
  assert.deepEqual(output.providers, ["local-fake-provider"]);
  assert.equal(output.chatReady, true);
});

test("chat sends one request to a proven fake-provider runtime", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "chat",
    "hello",
    "gateway",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.chatRequestCount, 1);
  assert.equal(gateway.lastPrompt, "hello gateway");
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.outputText, "mock response");
  assert.equal(output.executionMode, "fake");
  assert.equal(output.realProviderAuthorized, false);
});

test("enhance previews a structured prompt without checking or calling a provider", async (context) => {
  const gateway = await createMockGateway({ realProviderEnabled: true });
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "build an API",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.promptEnhancementRequestCount, 1);
  assert.equal(gateway.chatRequestCount, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.original, "build an API");
  assert.equal(output.profile, "coding");
  assert.equal(output.language, "zh-CN");
  assert.match(output.enhancedPrompt, /Execution requirements/);
  assert.equal(output.metadata.providerCalled, false);
  assert.equal(gateway.lastPromptEnhancementLanguage, "zh-CN");
});

test("enhance human output explains optional questions and safety evidence", async (context) => {
  const gateway = await createMockGateway({
    clarifyingQuestions: ["What output format and level of detail do you want?"],
  });
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "build an API",
    "--profile",
    "coding",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Questions to refine \(optional\)/);
  assert.match(result.stdout, /What output format and level of detail do you want\?/);
  assert.match(result.stdout, /provider call none/);
  assert.match(result.stdout, /credentials not required/);
  assert.match(result.stdout, /deterministic yes/);
  assert.match(result.stdout, /Original request preserved/);
});

test("enhance can emit report-ready provider-free evidence", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "build an API",
    "--profile",
    "coding",
    "--language",
    "en",
    "--evidence",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.schema, "unified-ai-system/usage-report/v1");
  assert.match(evidence.command, /pnpm gateway enhance/);
  assert.equal(evidence.mode, "prompt-enhancement");
  assert.equal(evidence.providerCalled, false);
  assert.equal(evidence.credentialRequired, false);
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.original, "build an API");
  assert.equal(evidence.profile, "coding");
  assert.equal(evidence.language, "en");
  assert.equal(evidence.reviewBeforeSharing, true);
});

test("demo can enhance a prompt in one isolated fake-provider run", async () => {
  const result = await runCliProcess([
    "demo",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.executionMode, "fake");
  assert.equal(output.realProviderCallsMade, false);
  assert.equal(output.promptEnhancement.profile, "coding");
  assert.equal(output.promptEnhancement.language, "zh-CN");
  assert.equal(output.promptEnhancement.metadata.providerCalled, false);
  assert.match(output.promptEnhancement.enhancedPrompt, /执行要求/);
});

test("demo can emit report-ready evidence without changing fake execution", async () => {
  const result = await runCliProcess([
    "demo",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--evidence",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.schema, "unified-ai-system/usage-report/v1");
  assert.match(evidence.command, /--enhance --profile coding/);
  assert.equal(evidence.mode, "fake");
  assert.equal(evidence.providerCalled, false);
  assert.equal(evidence.credentialRequired, false);
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.original, "build an API");
  assert.equal(evidence.reviewBeforeSharing, true);
});

test("chat opts into gateway enhancement only with --enhance", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "chat",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(gateway.lastPromptEnhancement, {
    enabled: true,
    profile: "coding",
    language: "zh-CN",
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.promptEnhancement.applied, true);
  assert.equal(output.promptEnhancement.profile, "coding");
  assert.equal(output.promptEnhancement.language, "zh-CN");
});

test("chat blocks a real-provider runtime until explicitly authorized", async (context) => {
  const gateway = await createMockGateway({ realProviderEnabled: true });
  context.after(gateway.close);

  const blocked = await runCliProcess([
    "chat",
    "do not send",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(blocked.code, 2);
  assert.equal(gateway.chatRequestCount, 0);
  const failure = JSON.parse(blocked.stderr);
  assert.equal(failure.ok, false);
  assert.match(failure.error, /request was not sent/i);

  const authorized = await runCliProcess([
    "chat",
    "authorized request",
    "--json",
    "--url",
    gateway.url,
    "--allow-real-provider",
  ]);

  assert.equal(authorized.code, 0, authorized.stderr);
  assert.equal(gateway.chatRequestCount, 1);
  const output = JSON.parse(authorized.stdout);
  assert.equal(output.realProviderAuthorized, true);
  assert.equal(output.executionMode, "real");
});

test("doctor treats an offline gateway as optional", async () => {
  const result = await runCliProcess([
    "doctor",
    "--json",
    "--url",
    "http://127.0.0.1:9",
    "--timeout",
    "100",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.gateway.reachable, false);
  assert.equal(output.nextAction, "pnpm gateway serve");
});

async function createMockGateway(options = {}) {
  let chatRequestCount = 0;
  let promptEnhancementRequestCount = 0;
  let lastPrompt = null;
  let lastPromptEnhancement = null;
  let lastPromptEnhancementLanguage = null;
  const realProviderEnabled = options.realProviderEnabled === true;
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health/check") {
      return writeJson(response, 200, {
        success: true,
        data: {
          status: "ready",
          providerMode: realProviderEnabled ? "real" : "fake",
          realProviderEnabled,
          providers: [
            {
              id: realProviderEnabled
                ? "mock-real-provider"
                : "local-fake-provider",
            },
          ],
        },
      });
    }

    if (request.method === "GET" && request.url === "/setup/readiness") {
      return writeJson(response, 200, {
        success: true,
        data: {
          readiness: {
            chat: { ready: true },
          },
        },
      });
    }

    if (request.method === "POST" && request.url === "/chat") {
      chatRequestCount += 1;
      const body = await readJsonBody(request);
      lastPrompt = body.messages?.[0]?.content ?? null;
      lastPromptEnhancement = body.promptEnhancement ?? null;
      return writeJson(response, 200, {
        success: true,
        data: {
          outputText: "mock response",
          selectedProvider: realProviderEnabled
            ? "mock-real-provider"
            : "local-fake-provider",
          selectedModel: realProviderEnabled
            ? "mock-real-model"
            : "local-fake-model",
          executionMode: realProviderEnabled ? "real" : "fake",
          executionStatus: "completed",
          ...(body.promptEnhancement?.enabled
            ? {
                promptEnhancement: {
                  applied: true,
                  profile: body.promptEnhancement.profile ?? "general",
                  language: body.promptEnhancement.language ?? "auto",
                  engine: "local-deterministic",
                  version: "prompt-enhancer-v1",
                  providerCalled: false,
                  originalPreserved: true,
                },
              }
            : {}),
        },
      });
    }

    if (request.method === "POST" && request.url === "/prompts/enhance") {
      promptEnhancementRequestCount += 1;
      const body = await readJsonBody(request);
      lastPromptEnhancementLanguage = body.language ?? "auto";
      return writeJson(response, 200, {
        status: "ok",
        data: {
          original: body.input,
          enhancedPrompt: `# Task\n\n${body.input}\n\n# Execution requirements`,
          profile: body.profile === "auto" ? "general" : body.profile,
          language: body.language ?? "auto",
          clarifyingQuestions: options.clarifyingQuestions ?? [],
          metadata: {
            engine: "local-deterministic",
            providerCalled: false,
            credentialRequired: false,
            originalPreserved: true,
            deterministic: true,
          },
        },
      });
    }

    return writeJson(response, 404, {
      success: false,
      error: { message: "not found" },
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(port);

  return {
    url: `http://127.0.0.1:${port}`,
    get chatRequestCount() {
      return chatRequestCount;
    },
    get promptEnhancementRequestCount() {
      return promptEnhancementRequestCount;
    },
    get lastPrompt() {
      return lastPrompt;
    },
    get lastPromptEnhancement() {
      return lastPromptEnhancement;
    },
    get lastPromptEnhancementLanguage() {
      return lastPromptEnhancementLanguage;
    },
    close: () =>
      new Promise((resolvePromise, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolvePromise();
        });
      }),
  };
}

function runCliProcess(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cliEntrypoint, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 20_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolvePromise({
        code: code ?? (signal ? 1 : 0),
        stdout,
        stderr,
      });
    });
    child.stdin.end();
  });
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}
