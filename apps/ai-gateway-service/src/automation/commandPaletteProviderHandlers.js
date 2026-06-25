import fs from "fs/promises";
import path from "path";
import { PROVIDERS_CONFIG } from "./commandPaletteConstants.js";

/**
 * Provider command handlers for CommandPaletteService.
 * Extracted from commandPaletteService.js to stay under 500 lines.
 *
 * Each handler receives the service instance as its first argument
 * and is registered with .bind(null, svc) so that `this` still works.
 */

/** List all providers from providers-config.json */
export async function providerList(svc) {
  const config = await svc._readProvidersConfig();
  const providers = (config.providers ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? p.nameEn ?? p.id,
    baseUrl: p.baseUrl,
    free: p.free ?? false,
    region: p.region ?? "global",
    category: p.category ?? "standard",
    models: (p.models ?? []).length,
    configured: Boolean(p.apiKey),
  }));

  return { count: providers.length, providers };
}

/** Add a new provider */
export async function providerAdd(svc, args) {
  const id = args.id ?? args._pos0;
  const name = args.name ?? args._pos1 ?? id;
  const baseUrl = args.baseUrl ?? args._pos2;

  if (!id) throw new Error("Provider id is required.");
  if (!baseUrl) throw new Error("Provider baseUrl is required.");

  // Validate provider ID: only allow safe characters
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Invalid provider id: only alphanumeric, dash, and underscore characters are allowed.");
  }

  // Validate baseUrl format: must be a valid HTTP(S) URL
  try {
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Invalid baseUrl: only http and https protocols are allowed.");
    }
  } catch (e) {
    throw new Error(`Invalid baseUrl format: "${baseUrl}".`);
  }

  const config = await svc._readProvidersConfig();
  const existing = config.providers.find((p) => p.id === id);
  if (existing) throw new Error(`Provider "${id}" already exists.`);

  const newProvider = {
    id,
    name,
    nameEn: name,
    apiKey: "",
    baseUrl,
    openaiCompatible: true,
    models: [],
    defaultModel: "",
    free: false,
    region: "global",
    category: "custom",
  };

  config.providers.push(newProvider);
  await svc._writeProvidersConfig(config);

  return { added: newProvider };
}

/** Remove a provider */
export async function providerRemove(svc, args) {
  const id = args.id ?? args._pos0;
  if (!id) throw new Error("Provider id is required.");

  const config = await svc._readProvidersConfig();
  const idx = config.providers.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Provider "${id}" not found.`);

  const removed = config.providers.splice(idx, 1)[0];
  await svc._writeProvidersConfig(config);

  return { removed: { id: removed.id, name: removed.name } };
}

/** Test provider connectivity */
export async function providerTest(svc, args) {
  const id = args.id ?? args._pos0;
  if (!id) throw new Error("Provider id is required.");

  const config = await svc._readProvidersConfig();
  const provider = config.providers.find((p) => p.id === id);
  if (!provider) throw new Error(`Provider "${id}" not found.`);

  // SSRF protection: validate baseUrl before making request
  try {
    const targetUrl = new URL(provider.baseUrl);
    const ip = targetUrl.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (ip === "localhost" || ip === "::1" || /^127\./.test(ip) || /^10\./.test(ip) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^192\.168\./.test(ip) ||
        /^169\.254\./.test(ip) || /^0\./.test(ip) ||
        ip === "metadata.google.internal" || ip === "metadata" || ip === "instance-data" ||
        ip.endsWith(".local") || ip.endsWith(".internal")) {
      // Allow localhost for normal provider operation, block other private ranges
      if (ip !== "localhost" && ip !== "::1" && !(/^127\./.test(ip))) {
        throw new Error("Connection to private/internal networks is not allowed.");
      }
    }
  } catch (e) {
    if (e.message.includes("not allowed")) throw e;
    // URL parse errors are handled by fetch failure below
  }

  const startTime = Date.now();
  try {
    // Simple HTTP connectivity test (HEAD or GET to baseUrl)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(provider.baseUrl, {
      method: "GET",
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    return {
      providerId: id,
      reachable: response !== null,
      statusCode: response?.status ?? null,
      latencyMs,
      baseUrl: provider.baseUrl,
    };
  } catch (err) {
    return {
      providerId: id,
      reachable: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

/** Provider health overview */
export async function providerHealth(svc) {
  const config = await svc._readProvidersConfig();
  const results = [];

  for (const p of config.providers ?? []) {
    results.push({
      id: p.id,
      name: p.name ?? p.id,
      configured: Boolean(p.apiKey),
      baseUrl: p.baseUrl,
      modelCount: (p.models ?? []).length,
      status: p.apiKey ? "configured" : "no_api_key",
    });
  }

  return {
    total: results.length,
    configured: results.filter((r) => r.status === "configured").length,
    unconfigured: results.filter((r) => r.status !== "configured").length,
    providers: results,
  };
}
