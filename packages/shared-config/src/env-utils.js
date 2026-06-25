/**
 * Environment variable parsing utilities for shared-config.
 * Extracted from shared-config/src/index.js to keep the main module under 500 lines.
 */

export function readNumber(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readList(value, fallback) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readRouteMode(value, fallback) {
  if (value === "fixed" || value === "registry-default") {
    return value;
  }

  return fallback;
}

export function readProviderMode(value, fallback) {
  if (value === "fake" || value === "real" || value === "auto") {
    return value;
  }

  return fallback;
}

export function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}
