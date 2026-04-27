export interface PackageStatus {
  name: string;
  status: "ready";
  phase: "phase-1-skeleton";
}

export function createPackageStatus(name: string): PackageStatus {
  return {
    name,
    status: "ready",
    phase: "phase-1-skeleton",
  };
}

export interface ResultEnvelope<TData = unknown> {
  status: "ok" | "error";
  data?: TData;
  error?: {
    code: string;
    message: string;
    category?: string;
    retryable?: boolean;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    traceId?: string;
    createdAt: string;
    durationMs?: number;
  };
}

export declare function createRequestId(prefix?: string): string;
export declare function createOkEnvelope<TData>(
  data: TData,
  params?: { requestId?: string; traceId?: string; startedAt?: number },
): ResultEnvelope<TData>;
export declare function createErrorEnvelope(
  code: string,
  message: string,
  params?: {
    requestId?: string;
    traceId?: string;
    startedAt?: number;
    category?: string;
    retryable?: boolean;
    details?: unknown;
  },
): ResultEnvelope<never>;
export declare function withTimeout<TValue>(
  task: Promise<TValue>,
  params: { timeoutMs: number; label?: string },
): Promise<TValue>;
