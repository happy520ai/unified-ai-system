// T-094 leaf: type-only declarations extracted from idempotencyCoordinator.ts
// (mechanical move certified by .pm/t094-leaf-closures.json; no runtime declarations dragged).
import type { IncomingHttpHeaders } from "node:http";

export type IdempotencyRequest = {
  headers?: IncomingHttpHeaders;
  socket?: { remoteAddress?: string | null };
};

export type IdempotencyAcceptedOutcome<T> = {
  accepted: true;
  status: "bypassed" | "created" | "created-unconfirmed" | "replayed";
  replayed: boolean;
  replayable: boolean;
  value: T;
};

export type IdempotencyRejectedOutcome = {
  accepted: false;
  status: "rejected";
  replayed: false;
  statusCode: number;
  code: string;
  message: string;
  retryable: boolean;
  replayable: false;
  retryAfterSeconds?: number;
};

export type IdempotencyOutcome<T> = IdempotencyAcceptedOutcome<T> | IdempotencyRejectedOutcome;

export type IdempotencyExecution<T> = {
  request?: IdempotencyRequest;
  route: string;
  payload: unknown;
  operation: () => T | Promise<T>;
};


export type IdempotencyCoordinator = {
  execute<T>(execution: IdempotencyExecution<T>): Promise<IdempotencyOutcome<T>>;
  getStats(): {
    entries: number;
    inFlight: number;
    replayable: number;
    tombstones: number;
    ttlMs: number;
    maxEntries: number;
    maxResultBytes: number;
    storeMode: "memory" | "sqlite" | "postgres";
    available?: boolean;
    distributed?: boolean;
    statsUpdatedAt?: number | null;
  };
  checkHealth?(): Promise<ReturnType<IdempotencyCoordinator["getStats"]>>;
  close(): void | Promise<void>;
};
