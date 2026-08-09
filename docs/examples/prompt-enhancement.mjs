#!/usr/bin/env node

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:3100";
const DEFAULT_INPUT = "Help me plan a small API for my team";
const DEFAULT_PROFILE = "planning";
const DEFAULT_LANGUAGE = "en";
const REQUEST_TIMEOUT_MS = 10_000;
const PROFILES = new Set([
  "auto",
  "general",
  "coding",
  "analysis",
  "writing",
  "research",
  "planning",
]);
const LANGUAGES = new Set(["auto", "zh-CN", "en"]);

function usage() {
  return `Usage: node docs/examples/prompt-enhancement.mjs [input] [options]

Options:
  --base-url <url>       Gateway URL (default: ${DEFAULT_GATEWAY_URL})
  --profile <profile>    Enhancement profile (default: ${DEFAULT_PROFILE})
  --language <language>  Output language (default: ${DEFAULT_LANGUAGE})
  --help                 Show this message
`;
}

function readOption(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(args) {
  const inputParts = [];
  const options = {
    baseUrl: DEFAULT_GATEWAY_URL,
    profile: DEFAULT_PROFILE,
    language: DEFAULT_LANGUAGE,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--base-url") {
      options.baseUrl = readOption(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--profile") {
      options.profile = readOption(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--language") {
      options.language = readOption(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
      continue;
    }
    if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
      continue;
    }
    if (arg.startsWith("--language=")) {
      options.language = arg.slice("--language=".length);
      continue;
    }
    if (arg === "--") {
      inputParts.push(...args.slice(index + 1));
      break;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    inputParts.push(arg);
  }

  const input = inputParts.join(" ").trim() || DEFAULT_INPUT;
  if (!PROFILES.has(options.profile)) {
    throw new Error(`Unsupported profile: ${options.profile}`);
  }
  if (!LANGUAGES.has(options.language)) {
    throw new Error(`Unsupported language: ${options.language}`);
  }

  try {
    const url = new URL(options.baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("The gateway URL must use http or https.");
    }
    options.baseUrl = url.toString().replace(/\/$/, "");
  } catch (error) {
    throw new Error(
      `Invalid gateway URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { ...options, input };
}

async function requestJson(baseUrl, pathname, options = {}) {
  let response;
  try {
    response = await fetch(new URL(pathname, baseUrl), {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(`${pathname} timed out after ${REQUEST_TIMEOUT_MS} ms.`);
    }
    throw new Error(
      `${pathname} could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const rawBody = await response.text();
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error(`${pathname} returned invalid JSON with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const detail = body?.error?.message ?? body?.message ?? "The request failed.";
    throw new Error(`${pathname} returned HTTP ${response.status}: ${detail}`);
  }
  return body;
}

function requireProviderFreeHealth(health) {
  if (
    health?.status !== "ok"
    || health?.data?.status !== "ready"
    || health.data.realProviderEnabled !== false
  ) {
    throw new Error(
      "Refusing to continue: the gateway is not ready in explicit provider-free mode.",
    );
  }
}

function requireProviderFreeEnhancement(body, input) {
  const data = body?.data;
  const metadata = data?.metadata;
  if (
    body?.status !== "ok"
    || typeof data?.enhancedPrompt !== "string"
    || data.original !== input
    || !data.enhancedPrompt.includes(input)
    || metadata?.engine !== "local-deterministic"
    || metadata?.providerCalled !== false
    || metadata?.credentialRequired !== false
    || metadata?.deterministic !== true
  ) {
    throw new Error(
      "The response did not prove local deterministic prompt enhancement.",
    );
  }
  return data;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const health = await requestJson(options.baseUrl, "/health/check", { headers });
  requireProviderFreeHealth(health);

  const response = await requestJson(options.baseUrl, "/prompts/enhance", {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: options.input,
      profile: options.profile,
      language: options.language,
    }),
  });
  const data = requireProviderFreeEnhancement(response, options.input);

  console.log(JSON.stringify({
    original: data.original,
    enhancedPrompt: data.enhancedPrompt,
    profile: data.profile,
    language: data.language,
    metadata: data.metadata,
  }, null, 2));
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Prompt enhancement example failed: ${message}`);
  process.exitCode = 1;
}
