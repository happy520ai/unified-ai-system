import { existsSync, readFileSync } from "node:fs";

export function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function roundNumber(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function readTextIfExists(path) {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function hasAnyTrue(sources, key) {
  return Object.values(sources).some(({ data }) => data?.[key] === true || data?.safety?.[key] === true);
}

export function calculateGrade(totalScore) {
  if (totalScore >= 85) return "A";
  if (totalScore >= 70) return "B";
  if (totalScore >= 55) return "C";
  return "D";
}

export function calculateCacheHitRate(cache) {
  const hits = numberOrZero(cache?.summary?.hitCount);
  const misses = numberOrZero(cache?.summary?.missCount);
  if (hits + misses <= 0) return null;
  return roundNumber(hits / (hits + misses), 4);
}
