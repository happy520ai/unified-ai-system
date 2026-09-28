// The two pure decisions inside the npm resolution probe, separated from the network so they can be
// tested: encoding a scoped package name for npm's registry endpoint, and turning the pair of HTTP
// statuses into a verdict.
//
// Both look trivial and both are where an inverted bug would hide. `encPkg` must produce `@scope%2fname`
// (npm's own API form) - a raw slash makes the request address a different path and yields a 404 for a
// package that exists. `classify` must treat "package exists but this version does not" as a separate
// outcome from "package does not exist", because the second is an install failure and the first is a
// stale listing, and collapsing them would let either explanation absorb the other.

export function encPkg(name) {
  if (typeof name !== "string" || name.length === 0) throw new Error("REFUSED: package name must be a non-empty string");
  return name.startsWith("@") ? name.replace("/", "%2f") : name;
}

export function classify(pkgStatus, versionStatus) {
  if (typeof pkgStatus === "string" || typeof versionStatus === "string") return "transport_error";
  if (pkgStatus === 404) return "package_missing";
  if (pkgStatus === 402) return "package_blocked_402";
  if (pkgStatus >= 200 && pkgStatus < 300 && versionStatus >= 200 && versionStatus < 300) return "listed_version_published";
  if (pkgStatus >= 200 && pkgStatus < 300 && versionStatus === 404) return "package_exists_version_missing";
  if (pkgStatus >= 500 || versionStatus >= 500) return "server_error_" + pkgStatus + "_" + versionStatus;
  return "other_http_" + pkgStatus + "_" + versionStatus;
}

// A verdict counts against the headline "a client cannot install what is listed" only when the registry
// entry points at something npm will not hand over at the listed version.
const UNUSABLE = new Set(["package_missing", "package_exists_version_missing", "package_blocked_402"]);
export function isUnusable(verdict) {
  return UNUSABLE.has(verdict);
}

// Only these four readings mean npm answered the question. Anything else - a 406 from a CDN node that
// dislikes the Accept header, a 5xx, a transport failure - is this instrument not having measured
// something, and must leave the denominator instead of diluting it. Measured on 2026-09-28: the same
// version path answered 406 once and 200 on the next attempt under `application/vnd.npm.install-v1+json`,
// so an ambiguous status here is a real condition and not a hypothetical.
const DEFINITE = new Set(["package_missing", "package_exists_version_missing", "package_blocked_402", "listed_version_published"]);
export function isDefinite(verdict) {
  return DEFINITE.has(verdict);
}

export function waldCi(bad, definite, z = 1.96) {
  if (definite <= 0) throw new Error("REFUSED: no definite readings, so no interval exists");
  const p = bad / definite;
  const se = Math.sqrt(p * (1 - p) / definite);
  return [Math.max(0, p - z * se), Math.min(1, p + z * se)];
}
