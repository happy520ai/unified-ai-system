export function canonicalize(value) {
  return JSON.stringify(normalizeForCanonicalJson(value));
}

export function normalizeForCanonicalJson(value) {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCanonicalJson(item));
  }
  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        const item = value[key];
        if (typeof item !== "undefined") {
          normalized[key] = normalizeForCanonicalJson(item);
        }
        return normalized;
      }, {});
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Cannot canonicalize non-finite numbers.");
    }
    return value;
  }
  if (typeof value === "bigint") {
    throw new TypeError("Cannot canonicalize bigint values.");
  }
  if (typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Cannot canonicalize ${typeof value} values.`);
  }
  return value;
}
