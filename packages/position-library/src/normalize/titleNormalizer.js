export function normalizeTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\b(ai|ux|qa|hr|it)\b/gi, (match) => match.toUpperCase())
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function titleSearchKey(value) {
  return normalizeTitle(value).toLowerCase();
}

