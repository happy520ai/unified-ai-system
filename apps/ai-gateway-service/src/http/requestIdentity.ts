import { createHmac } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import ipaddr from "ipaddr.js";

type RequestLike = {
  headers?: IncomingHttpHeaders;
  socket?: { remoteAddress?: string | null };
};

export type RequestSubjectMode = "network" | "credential-or-network";

export type RequestIdentity = {
  subject: string;
  subjectKind: "credential" | "network";
  clientAddress: string;
  forwarded: boolean;
  trustedProxyHops: number;
};

type RequestIdentityResolverOptions = {
  maxForwardedHops?: number;
  secret?: string | Buffer;
  subjectMode?: RequestSubjectMode;
  trustedProxyCidrs?: string[];
};

type ParsedAddress = {
  address: string;
  value: ipaddr.IPv4 | ipaddr.IPv6;
};

type TrustedRange = [ipaddr.IPv4 | ipaddr.IPv6, number];

const DEFAULT_MAX_FORWARDED_HOPS = 32;

export function createRequestIdentityResolver(options: RequestIdentityResolverOptions = {}) {
  const subjectMode = options.subjectMode ?? "network";
  if (subjectMode !== "network" && subjectMode !== "credential-or-network") {
    throw new Error(`Unsupported request subject mode: ${String(subjectMode)}`);
  }
  if (subjectMode === "credential-or-network" && (!options.secret || Buffer.byteLength(options.secret) < 32)) {
    throw new Error("A request subject HMAC secret of at least 32 bytes is required in credential-or-network mode.");
  }
  const maxForwardedHops = clampInteger(options.maxForwardedHops ?? DEFAULT_MAX_FORWARDED_HOPS, 1, 128);
  const trustedRanges = (options.trustedProxyCidrs ?? []).map(parseTrustedRange);

  return {
    resolve(request?: RequestLike): RequestIdentity {
      const network = resolveNetworkIdentity(request, trustedRanges, maxForwardedHops);
      const credential = subjectMode === "credential-or-network" ? readCredential(request?.headers) : null;
      if (credential) {
        return {
          ...network,
          subject: `credential:${createHmac("sha256", options.secret!).update(credential).digest("hex")}`,
          subjectKind: "credential",
        };
      }
      return {
        ...network,
        subject: `network:${network.clientAddress}`,
        subjectKind: "network",
      };
    },
    getConfig() {
      return {
        subjectMode,
        trustedProxyCount: trustedRanges.length,
        maxForwardedHops,
      };
    },
  };
}

export function parseTrustedProxyCidrs(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
}

function resolveNetworkIdentity(
  request: RequestLike | undefined,
  trustedRanges: TrustedRange[],
  maxForwardedHops: number,
): Omit<RequestIdentity, "subject" | "subjectKind"> {
  const direct = parseAddress(request?.socket?.remoteAddress) ?? parseAddress("0.0.0.0")!;
  if (!isTrusted(direct.value, trustedRanges)) {
    return { clientAddress: direct.address, forwarded: false, trustedProxyHops: 0 };
  }

  const forwarded = readForwardedChain(request?.headers?.["x-forwarded-for"], maxForwardedHops);
  if (!forwarded) {
    return { clientAddress: direct.address, forwarded: false, trustedProxyHops: 0 };
  }

  let current = direct;
  let trustedProxyHops = 0;
  for (let index = forwarded.length - 1; index >= 0; index -= 1) {
    if (!isTrusted(current.value, trustedRanges)) break;
    trustedProxyHops += 1;
    current = forwarded[index];
  }
  return {
    clientAddress: current.address,
    forwarded: current.address !== direct.address,
    trustedProxyHops,
  };
}

function readForwardedChain(value: string | string[] | undefined, maxForwardedHops: number): ParsedAddress[] | null {
  if (typeof value !== "string") return null;
  const fields = value.split(",");
  if (fields.length < 1 || fields.length > maxForwardedHops) return null;
  const addresses: ParsedAddress[] = [];
  for (const field of fields) {
    const parsed = parseAddress(field.trim());
    if (!parsed) return null;
    addresses.push(parsed);
  }
  return addresses;
}

function parseAddress(value: unknown): ParsedAddress | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    let parsed = ipaddr.parse(value.trim());
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
    return { address: parsed.toString(), value: parsed };
  } catch {
    return null;
  }
}

function parseTrustedRange(value: string): TrustedRange {
  try {
    const [address, prefix] = ipaddr.parseCIDR(value);
    if (address.kind() === "ipv6" && address.isIPv4MappedAddress()) {
      if (prefix < 96) throw new Error("IPv4-mapped IPv6 CIDR prefixes must be at least 96 bits.");
      return [address.toIPv4Address(), prefix - 96];
    }
    return [address, prefix];
  } catch (error) {
    throw new Error(`Invalid trusted proxy CIDR: ${value}`, { cause: error });
  }
}

function isTrusted(address: ipaddr.IPv4 | ipaddr.IPv6, ranges: TrustedRange[]): boolean {
  return ranges.some(([range, prefix]) => address.kind() === range.kind() && address.match(range, prefix));
}

function readCredential(headers: IncomingHttpHeaders | undefined): string | null {
  const value = headers?.authorization ?? headers?.["x-api-key"];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
