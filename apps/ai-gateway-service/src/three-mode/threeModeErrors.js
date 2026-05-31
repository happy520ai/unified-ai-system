export const THREE_MODE_ERROR_CODES = Object.freeze({
  MODE_NOT_ENABLED: "MODE_NOT_ENABLED",
  MODEL_NOT_SELECTABLE: "MODEL_NOT_SELECTABLE",
  MODEL_HIGH_RISK: "MODEL_HIGH_RISK",
  MODEL_NOT_CONFIGURED: "MODEL_NOT_CONFIGURED",
  USER_CREDENTIAL_MISSING: "USER_CREDENTIAL_MISSING",
  USER_CREDENTIAL_RUNTIME_NOT_READY: "USER_CREDENTIAL_RUNTIME_NOT_READY",
  PROVIDER_NOT_ENABLED: "PROVIDER_NOT_ENABLED",
  NON_NVIDIA_REAL_CALL_NOT_AUTHORIZED: "NON_NVIDIA_REAL_CALL_NOT_AUTHORIZED",
  SECRET_VALUE_FORBIDDEN: "SECRET_VALUE_FORBIDDEN",
  GOD_MODE_INSUFFICIENT_PARTICIPANTS: "GOD_MODE_INSUFFICIENT_PARTICIPANTS",
  TIANSHU_NO_ELIGIBLE_MODEL: "TIANSHU_NO_ELIGIBLE_MODEL",
  SUPERVISOR_MODEL_UNAVAILABLE: "SUPERVISOR_MODEL_UNAVAILABLE",
  THREE_MODE_RUNTIME_ERROR: "THREE_MODE_RUNTIME_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
});

export class ThreeModeRuntimeError extends Error {
  constructor(code, message, details = {}, recoverable = true) {
    super(message);
    this.name = "ThreeModeRuntimeError";
    this.code = code;
    this.details = details;
    this.recoverable = recoverable;
  }
}

export function toThreeModeError(error) {
  if (error instanceof ThreeModeRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      details: error.details ?? {},
    };
  }
  return {
    code: THREE_MODE_ERROR_CODES.THREE_MODE_RUNTIME_ERROR,
    message: error instanceof Error ? error.message : String(error),
    recoverable: true,
    details: {},
  };
}
