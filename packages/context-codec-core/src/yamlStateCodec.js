function renderScalar(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return String(value).replace(/\r?\n/g, " ");
}

function renderYamlArrayItem(item, indent) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const entries = Object.entries(item);
    if (entries.length === 0) {
      return [`${indent}- {}`];
    }
    const [[firstKey, firstValue], ...rest] = entries;
    return [
      `${indent}- ${firstKey}: ${renderScalar(firstValue)}`,
      ...rest.flatMap(([childKey, childValue]) => renderYamlValue(childKey, childValue, `${indent}  `)),
    ];
  }
  return [`${indent}- ${renderScalar(item)}`];
}

function renderYamlValue(key, value, indent = "") {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}${key}: []`];
    }
    return [`${indent}${key}:`, ...value.flatMap((item) => renderYamlArrayItem(item, `${indent}  `))];
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${indent}${key}: {}`];
    }
    return [
      `${indent}${key}:`,
      ...entries.flatMap(([childKey, childValue]) => renderYamlValue(childKey, childValue, `${indent}  `)),
    ];
  }
  return [`${indent}${key}: ${renderScalar(value)}`];
}

export function encodeYamlState(state) {
  return Object.entries(state).flatMap(([key, value]) => renderYamlValue(key, value)).join("\n");
}
