import {
  createPinnedLookup,
  OutboundUrlPolicyError,
  resolveSafeOutboundUrl,
} from "./outboundUrlPolicy.ts";

type PinnedAddress = Readonly<{ address: string; family: 4 | 6 }>;

const LOOPBACK_ADDRESSES: ReadonlyMap<string, PinnedAddress> = new Map<string, PinnedAddress>([
  ["127.0.0.1", Object.freeze({ address: "127.0.0.1", family: 4 as const })],
  ["localhost", Object.freeze({ address: "127.0.0.1", family: 4 as const })],
  ["::1", Object.freeze({ address: "::1", family: 6 as const })],
]);

function normalizeHostname(value: unknown) {
  return String(value ?? "").trim().replace(/^\[|\]$/g, "").toLowerCase();
}

/**
 * Resolve an operator-configured gateway URL. Exact loopback names are
 * permitted and pinned for the gateway's normal same-host deployment; every
 * other destination retains the public-unicast-only outbound policy.
 */
export async function resolveGatewayOutboundUrl(rawUrl: unknown) {
  let url: URL;
  try {
    url = new URL(String(rawUrl ?? ""));
  } catch {
    throw new OutboundUrlPolicyError("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OutboundUrlPolicyError("unsupported_protocol");
  }
  if (url.username || url.password) {
    throw new OutboundUrlPolicyError("url_credentials_forbidden");
  }

  const hostname = normalizeHostname(url.hostname);
  const loopback = LOOPBACK_ADDRESSES.get(hostname);
  if (!loopback) return resolveSafeOutboundUrl(url.toString());

  const addresses = Object.freeze([loopback]);
  return Object.freeze({
    url: url.toString(),
    hostname,
    addresses,
    lookup: createPinnedLookup(addresses),
  });
}
