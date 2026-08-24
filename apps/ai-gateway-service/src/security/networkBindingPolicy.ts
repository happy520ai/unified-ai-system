import ipaddr from "ipaddr.js";

function normalizeHost(value: unknown): string {
  return String(value ?? "").trim().replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
}

export function isLoopbackAddress(value: unknown): boolean {
  const host = normalizeHost(value);
  if (!host) return false;
  if (host === "localhost") return true;
  try {
    const address = ipaddr.parse(host);
    if (address.kind() === "ipv6") {
      const ipv6 = address as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) return ipv6.toIPv4Address().range() === "loopback";
    }
    return address.range() === "loopback";
  } catch {
    return false;
  }
}

export function assertAuthenticatedNetworkBinding(options: {
  host: unknown;
  authEnabled: boolean;
}): void {
  if (options.authEnabled || isLoopbackAddress(options.host)) return;
  const error = new Error(
    "Enterprise authentication must be enabled before the gateway can bind to a non-loopback address.",
  ) as Error & { code: string; category: string; retryable: boolean };
  error.code = "enterprise_auth_required_for_non_loopback";
  error.category = "security";
  error.retryable = false;
  throw error;
}
