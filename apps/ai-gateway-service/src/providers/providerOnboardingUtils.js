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
import { isObviouslyUnsafeHostname } from "../security/outboundUrlPolicy.ts";

export function isPrivateOrReservedHost(hostname) {
  return isObviouslyUnsafeHostname(hostname);
}
