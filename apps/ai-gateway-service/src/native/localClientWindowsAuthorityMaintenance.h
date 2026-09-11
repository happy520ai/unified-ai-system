#pragma once

#include <cstddef>
#include <stdexcept>
#include <utility>

// This coordinator owns only phase ordering. The Win32 port owns exact package,
// journal, object identity, ACL, preservation and durability checks. Its caller
// must already hold the separate maintenance-file lock and a persisted intent.
namespace uai_authority_maintenance {

enum class Operation { Upgrade, AdoptExistingV3, RestoreLegacyV1, FreshInstall };
enum class Phase { Intent, Sealed, Blocked, CodeSwitched, StateExtended, ViewsPrepared, CommittedStopped, Complete };

struct Journal {
  Operation operation = Operation::Upgrade;
  Phase phase = Phase::Intent;
  unsigned sourceVersion = 0;
  unsigned targetVersion = 0;
  unsigned minPopProtocolVersion = 0;
  bool sourceHasMaintenance = false;
};

inline constexpr std::size_t kCodeFileCount = 7;

inline bool IsValid(const Journal& journal) noexcept {
  switch (journal.phase) {
    case Phase::Intent: case Phase::Sealed: case Phase::Blocked: case Phase::CodeSwitched:
    case Phase::StateExtended: case Phase::ViewsPrepared: case Phase::CommittedStopped: case Phase::Complete: break;
    default: return false;
  }
  // v4 implements PoP protocol 2. A future higher floor cannot be downgraded or
  // silently interpreted by this implementation; the persisted floor is never reset.
  if (journal.minPopProtocolVersion != 2) return false;
  switch (journal.operation) {
    case Operation::Upgrade:
      return journal.targetVersion == 4 && journal.sourceVersion >= 1 && journal.sourceVersion <= 4
        && (journal.sourceVersion < 3 || journal.sourceHasMaintenance);
    case Operation::AdoptExistingV3:
      return journal.sourceVersion == 3 && journal.targetVersion == 4 && !journal.sourceHasMaintenance;
    case Operation::RestoreLegacyV1:
      return journal.sourceVersion == 4 && journal.targetVersion == 1 && journal.sourceHasMaintenance;
    case Operation::FreshInstall:
      return journal.sourceVersion == 0 && journal.targetVersion == 4 && !journal.sourceHasMaintenance
        && (journal.phase == Phase::CommittedStopped || journal.phase == Phase::Complete);
    default: return false;
  }
}

template<class Port> class BrokerLock final {
 public:
  explicit BrokerLock(Port& port) noexcept : port_(port) {
    static_assert(noexcept(std::declval<Port&>().releaseBrokerLock()), "broker lock release must be noexcept");
  }
  BrokerLock(const BrokerLock&) = delete;
  BrokerLock& operator=(const BrokerLock&) = delete;
  void acquire() {
    // releaseBrokerLock must be a no-op when the port did not obtain ownership.
    // Arm first so a failure immediately after acquisition still gets cleanup.
    armed_ = true;
    port_.acquireBrokerLock();
  }
  ~BrokerLock() noexcept { if (armed_) port_.releaseBrokerLock(); }
 private:
  Port& port_;
  bool armed_ = false;
};

template<class Port> void Execute(Port& port, Journal& journal) {
  if (!IsValid(journal)) throw std::runtime_error("AUTHORITY_MAINTENANCE_JOURNAL_INVALID");
  if (journal.phase == Phase::Complete) { port.verifyComplete(); return; }
  if (journal.phase != Phase::CommittedStopped) {
    // A live worker may own the broker lock. Stop and observe process exit
    // before acquiring it; otherwise an updater can deadlock the service stop.
    port.ensureDisabled();
    port.ensureStopped();
    BrokerLock<Port> lock(port);
    lock.acquire();
    const auto advance = [&](Phase next) {
      port.advance(next);  // Persist + read back before moving the in-memory phase.
      journal.phase = next;
    };
    if (journal.phase == Phase::Intent) { port.seal(); advance(Phase::Sealed); }
    if (journal.phase == Phase::Sealed) { port.blockView(); advance(Phase::Blocked); }
    if (journal.phase == Phase::Blocked) {
      for (std::size_t index = 0; index < kCodeFileCount; ++index) port.replaceCode(index);
      advance(Phase::CodeSwitched);
    }
    if (journal.phase == Phase::CodeSwitched) { port.extendPoPState(); advance(Phase::StateExtended); }
    if (journal.phase == Phase::StateExtended) { port.prepareTargetViews(); advance(Phase::ViewsPrepared); }
    if (journal.phase == Phase::ViewsPrepared) {
      port.verifySealedPreservation();
      port.commitViews();
      advance(Phase::CommittedStopped);
    }
  } // Release before restoring demand-start. A process failure leaves it disabled.

  // An earlier attempt may have restored demand-start before losing its reply.
  // Legitimate runtime writes can now exist: never compare to or restore the old
  // sealed state here. The port verifies only committed code/config/view bindings.
  port.verifyCommittedView();
  port.restoreDemandStart();  // Idempotent; never starts the service.
  port.complete();           // Persist + read back completion before acknowledging it.
  journal.phase = Phase::Complete;
}

} // namespace uai_authority_maintenance
