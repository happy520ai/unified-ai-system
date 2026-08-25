import { lookup as systemLookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

type AddressRecord = Readonly<{ address: string; family: 4 | 6 }>;
type Resolver = (
  hostname: string,
  options: { all: true; order: "verbatim" },
) => Promise<Array<{ address: string; family: number }>>;

const MAX_RESOLVED_ADDRESSES = 32;
const BLOCKED_HOSTNAMES = new Set([
  "instance-data",
  "metadata",
  "metadata.amazonaws.com",
  "metadata.google.internal",
  "metadata.tencentyun.com",
]);
const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost", ".home.arpa"];

export class OutboundUrlPolicyError extends Error {
  readonly code = "OUTBOUND_URL_BLOCKED";
  readonly category = "security";
  readonly retryable = false;
  readonly reason: string;

  constructor(reason: string) {
    super("Outbound request blocked by the gateway network policy.");
    this.name = "OutboundUrlPolicyError";
    this.reason = reason;
  }
}

function normalizeHostname(value: unknown): string {
  return String(value ?? "").trim().replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function parseAddress(value: string): AddressRecord | null {
  try {
    let address = ipaddr.parse(normalizeHostname(value));
    if (address.kind() === "ipv6" && address.isIPv4MappedAddress()) {
      address = address.toIPv4Address();
    }
    return Object.freeze({
      address: address.toString(),
      family: address.kind() === "ipv4" ? 4 : 6,
    });
  } catch {
    return null;
  }
}

export function isPublicUnicastAddress(value: string): boolean {
  try {
    let address = ipaddr.parse(normalizeHostname(value));
    if (address.kind() === "ipv6" && address.isIPv4MappedAddress()) {
      address = address.toIPv4Address();
    }
    return address.range() === "unicast";
  } catch {
    return false;
  }
}

export function isObviouslyUnsafeHostname(value: unknown): boolean {
  const hostname = normalizeHostname(value);
  if (!hostname) return true;
  if (hostname === "localhost" || BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
  const literal = parseAddress(hostname);
  return literal ? !isPublicUnicastAddress(literal.address) : false;
}

export function createPinnedLookup(records: readonly AddressRecord[]) {
  const pinned = records.map((record) => ({ ...record }));
  return (_hostname: string, options: unknown, callback?: (...args: any[]) => void): void => {
    const resolvedCallback = typeof options === "function" ? options as (...args: any[]) => void : callback;
    const lookupOptions = typeof options === "object" && options !== null
      ? options as { all?: boolean; family?: number }
      : {};
    if (!resolvedCallback) return;
    const candidates = lookupOptions.family === 4 || lookupOptions.family === 6
      ? pinned.filter((record) => record.family === lookupOptions.family)
      : pinned;
    if (candidates.length === 0) {
      const error = new Error("No validated address matches the requested family.") as Error & { code: string };
      error.code = "EAI_ADDRFAMILY";
      queueMicrotask(() => resolvedCallback(error));
      return;
    }
    queueMicrotask(() => {
      if (lookupOptions.all) resolvedCallback(null, candidates.map((record) => ({ ...record })));
      else resolvedCallback(null, candidates[0].address, candidates[0].family);
    });
  };
}

export async function resolveSafeOutboundUrl(
  rawUrl: unknown,
  options: { lookup?: Resolver; maxAddresses?: number } = {},
) {
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
  if (isObviouslyUnsafeHostname(hostname)) {
    throw new OutboundUrlPolicyError("blocked_hostname_or_literal");
  }
  const literal = parseAddress(hostname);
  let records: Array<{ address: string; family: number }>;
  if (literal) {
    records = [literal];
  } else {
    const resolver: Resolver = options.lookup ?? (async (name) => (
      systemLookup(name, { all: true, order: "verbatim" }) as Promise<Array<{ address: string; family: number }>>
    ));
    try {
      records = await resolver(hostname, { all: true, order: "verbatim" });
    } catch {
      throw new OutboundUrlPolicyError("dns_resolution_failed");
    }
  }

  const maxAddresses = Math.min(Math.max(options.maxAddresses ?? MAX_RESOLVED_ADDRESSES, 1), MAX_RESOLVED_ADDRESSES);
  if (!Array.isArray(records) || records.length === 0 || records.length > maxAddresses) {
    throw new OutboundUrlPolicyError("dns_result_count_invalid");
  }
  const normalized = new Map<string, AddressRecord>();
  for (const record of records) {
    const parsed = parseAddress(record?.address);
    if (!parsed || !isPublicUnicastAddress(parsed.address)) {
      throw new OutboundUrlPolicyError("dns_resolved_to_non_public_address");
    }
    normalized.set(`${parsed.family}:${parsed.address}`, parsed);
  }
  const addresses = Object.freeze([...normalized.values()]);
  return Object.freeze({
    url: url.toString(),
    hostname,
    addresses,
    lookup: createPinnedLookup(addresses),
  });
}
