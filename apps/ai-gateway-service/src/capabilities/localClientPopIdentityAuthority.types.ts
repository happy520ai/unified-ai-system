// T-094 leaf: type-only declarations extracted from localClientPopIdentityAuthority.ts
// (mechanical move certified by .pm/t094-leaf-closures.json; no runtime declarations dragged).

export interface ManagedLocalClientPopReplayGuardStatus {
  readonly available: boolean;
  readonly durable: boolean;
  readonly distributed: boolean;
  readonly mode: string;
  readonly authenticatedReplaySet?: boolean;
  readonly snapshotRollbackProtected?: boolean;
  readonly defensiveEnabled?: boolean;
  readonly capacityIsolatedByScope?: boolean;
  readonly maxEntries?: number;
  readonly maxEntriesPerScope?: number;
}

export interface ManagedLocalClientPopReplayConsumeInput {
  readonly replayKeySha256: string;
  /**
   * Opaque authority scope used by shared guards for capacity isolation. This
   * remains optional so existing custom guards can continue implementing the
   * replay port; current authorities always provide it.
   */
  readonly replayScopeSha256?: string;
  readonly expiresAtMs: number;
  readonly nowMs: number;
}

export interface ManagedLocalClientPopReplayGuard {
  readonly status: ManagedLocalClientPopReplayGuardStatus;

  /**
   * This operation must atomically consume replayKeySha256 once and, when a
   * replayScopeSha256 is supplied, enforce any scope quota in the same atomic
   * operation. A distributed deployment must inject a distributed
   * implementation; a read-then-write implementation does not satisfy this
   * contract.
   */
  consumeOnce(
    this: void,
    input: ManagedLocalClientPopReplayConsumeInput,
  ):
    | "consumed"
    | "replayed"
    | "capacity"
    | Promise<"consumed" | "replayed" | "capacity">;

  close?(this: void): void | Promise<void>;
}
