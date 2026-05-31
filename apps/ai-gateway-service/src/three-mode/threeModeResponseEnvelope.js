import { toThreeModeError } from "./threeModeErrors.js";

export function createThreeModeSuccessEnvelope({ data, startedAt, code = "OK", message = "" }) {
  return {
    success: true,
    code,
    message,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
  };
}

export function createThreeModeErrorEnvelope({ error, startedAt, message = "Three Mode runtime request failed." }) {
  const normalized = toThreeModeError(error);
  return {
    success: false,
    code: "THREE_MODE_RUNTIME_ERROR",
    message,
    data: null,
    error: normalized,
    meta: {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
  };
}
