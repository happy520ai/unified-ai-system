/**
 * Provider Onboarding — SSRF protection utilities.
 *
 * Extracted from providerOnboardingService.js to keep the service class
 * under the 500-line limit.
 *
 * @module providers/providerOnboardingUtils
 */

/**
 * Check if a hostname resolves to a private/reserved network address.
 * Used to prevent SSRF attacks via provider baseUrl.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isPrivateOrReservedHost(hostname) {
  if (!hostname) return true;
  const ip = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (ip === "localhost" || ip === "::1" || ip === "0.0.0.0" || ip === "127.0.0.1") return true;
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  if (ip === "metadata.google.internal" || ip === "metadata" || ip === "instance-data") return true;
  if (ip.endsWith(".local") || ip.endsWith(".internal")) return true;
  return false;
}
