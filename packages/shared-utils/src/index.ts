export interface PackageStatus {
  name: string;
  status: "ready";
  phase: "phase-1-skeleton";
}

export declare const INLINE_IMAGE_POLICY: Readonly<{
  allowedMediaTypes: readonly ["image/png", "image/jpeg", "image/webp", "image/gif"];
  maxImagesPerRequest: number;
  maxBytesPerImage: number;
  maxTotalBytes: number;
}>;
export interface InlineImageInspection {
  mediaType: string;
  byteLength: number;
  base64Data: string;
  sha256: string;
}
export declare function inspectInlineImageDataUrl(value: unknown, policy?: typeof INLINE_IMAGE_POLICY): InlineImageInspection;
export declare function extractMessageText(content: unknown): string;
export declare function hasImageContent(content: unknown): boolean;
export declare function getMessageImageStats(
  messages: unknown,
  policy?: typeof INLINE_IMAGE_POLICY,
): { imageCount: number; totalBytes: number };
export declare function createMessageContentFingerprint(content: unknown): string;
export declare function replaceMessageTextContent(content: unknown, replacement: string): unknown;

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
export declare function sleep(ms: number): Promise<void>;
export declare const EXECUTION_ABORT_CODES: Readonly<{
  CLIENT_DISCONNECTED: "CLIENT_DISCONNECTED";
  GATEWAY_DEADLINE_EXCEEDED: "GATEWAY_DEADLINE_EXCEEDED";
}>;
export type ExecutionAbortCode = typeof EXECUTION_ABORT_CODES[keyof typeof EXECUTION_ABORT_CODES];
export declare class ExecutionAbortError extends Error {
  readonly code: ExecutionAbortCode;
  readonly category: "cancellation" | "timeout";
  readonly retryable: boolean;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;
}
export declare function createExecutionAbortError(
  code: ExecutionAbortCode,
  message: string,
  options?: {
    category?: "cancellation" | "timeout";
    retryable?: boolean;
    statusCode?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  },
): ExecutionAbortError;
export declare function isExecutionAbortError(error: unknown): error is ExecutionAbortError;
export declare function findExecutionAbortError(error: unknown, signal?: AbortSignal): ExecutionAbortError | null;
export declare function throwIfExecutionAborted(signal?: AbortSignal): void;
export declare function createLinkedAbortController(options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
  timeoutReason?: Error | (() => Error);
}): {
  controller: AbortController;
  signal: AbortSignal;
  cleanup(): void;
};
export declare function abortableSleep(ms: number, signal?: AbortSignal): Promise<void>;
export declare function listen(server: any, port?: number, host?: string): Promise<void>;
export declare function listenAtEphemeralUrl(server: any, host?: string): Promise<string>;
export declare function fetchJsonPayload(url: string, options?: Record<string, unknown>): Promise<unknown>;
export declare function writeEvidenceFiles(params: {
  evidenceDir: string;
  evidenceJsonPath: string;
  evidenceMdPath: string;
  body: unknown;
  renderMarkdown: (body: any) => string;
}): Promise<void>;
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
