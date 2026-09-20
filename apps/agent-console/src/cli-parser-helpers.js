import { CliUsageError } from "./cli-errors.js";

export function addPositional(options, value) {
  if (options.command === null) {
    options.command = value;
  } else {
    options.positionals.push(value);
  }
}

export function splitFlag(token) {
  const equalsIndex = token.indexOf("=");
  if (equalsIndex === -1) return [token, null];
  return [token.slice(0, equalsIndex), token.slice(equalsIndex + 1)];
}

export function readFlagValue(argv, index, flag, inlineValue) {
  const value = inlineValue ?? argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw new CliUsageError(`${flag} requires a value.`);
  }
  return value;
}

export function assertFlagHasNoInlineValue(flag, inlineValue) {
  if (inlineValue !== null) {
    throw new CliUsageError(`${flag} does not accept a value.`);
  }
}

export function parseIntegerOption(value, flag, minimum, maximum) {
  if (!/^\d+$/.test(value)) {
    throw new CliUsageError(`${flag} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CliUsageError(
      `${flag} must be between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}
