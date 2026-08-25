import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { Readable } from "node:stream";
import { fetchWithAgent } from "../http/connectionPool.js";
import {
  OutboundUrlPolicyError,
  resolveSafeOutboundUrl,
} from "./outboundUrlPolicy.ts";

const REDIRECT_STATUSES = new Set([300, 301, 302, 303, 305, 307, 308]);
const BODYLESS_STATUSES = new Set([204, 205, 304]);

function createPinnedAgent(url: string, lookup: unknown) {
  const AgentClass = new URL(url).protocol === "https:" ? HttpsAgent : HttpAgent;
  return new AgentClass({
    keepAlive: false,
    maxSockets: 1,
    lookup,
  });
}

function createHeaders(rawHeaders: unknown) {
  const headers = new Headers();
  if (rawHeaders && typeof (rawHeaders as Headers).forEach === "function") {
    (rawHeaders as Headers).forEach((value, key) => headers.append(key, value));
    return headers;
  }
  for (const [key, rawValue] of Object.entries(rawHeaders ?? {})) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) headers.append(key, String(value));
    } else if (rawValue !== undefined) {
      headers.append(key, String(rawValue));
    }
  }
  return headers;
}

function destroyBody(body: any) {
  body?.resume?.();
  body?.destroy?.();
  body?.cancel?.().catch?.(() => {});
}

export async function safeOutboundFetch(
  rawUrl: unknown,
  requestOptions: Record<string, any> = {},
  dependencies: Record<string, any> = {},
) {
  const resolveOutboundUrl = dependencies.resolveOutboundUrl ?? resolveSafeOutboundUrl;
  const request = dependencies.request ?? fetchWithAgent;
  const destination = await resolveOutboundUrl(rawUrl);
  const agent = (dependencies.createAgent ?? createPinnedAgent)(destination.url, destination.lookup);
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    agent?.destroy?.();
  };

  try {
    const rawResponse = await request(destination.url, {
      ...requestOptions,
      agent,
      lookup: destination.lookup,
    });
    const status = Number(rawResponse?.status ?? 0);

    if (REDIRECT_STATUSES.has(status)) {
      destroyBody(rawResponse?.body);
      cleanup();
      throw new OutboundUrlPolicyError("redirect_forbidden");
    }

    const rawBody = rawResponse?.body ?? null;
    rawBody?.once?.("end", cleanup);
    rawBody?.once?.("close", cleanup);
    rawBody?.once?.("error", cleanup);

    const method = String(requestOptions.method ?? "GET").toUpperCase();
    const bodyless = method === "HEAD" || BODYLESS_STATUSES.has(status);
    if (bodyless) {
      rawBody?.resume?.();
      if (!rawBody?.once) cleanup();
    }

    const body = bodyless || !rawBody
      ? null
      : typeof rawBody.getReader === "function"
        ? rawBody
        : Readable.toWeb(rawBody);

    return new Response(body as BodyInit | null, {
      status,
      statusText: String(rawResponse?.statusText ?? ""),
      headers: createHeaders(rawResponse?.headers),
    });
  } catch (error) {
    cleanup();
    throw error;
  }
}
