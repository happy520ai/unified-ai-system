// Literal network-target guard for forge-core's direct fetch lanes.
// Provider base URLs and download URLs must never reach loopback,
// link-local, or private network space. Literal guards only; full DNS
// pinning lives in the gateway's safeOutboundFetch (tracked as a
// shared-utils follow-up).

const UNSAFE_NETWORK_TARGET_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/i,
  /^\[?f[ec][0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i,
];

export function isObviouslyUnsafeNetworkTarget(rawUrl) {
  try {
    const url = new URL(String(rawUrl ?? ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    if (url.username || url.password) return true;
    const host = url.hostname.toLowerCase();
    return UNSAFE_NETWORK_TARGET_PATTERNS.some((pattern) => pattern.test(host));
  } catch {
    return true;
  }
}
