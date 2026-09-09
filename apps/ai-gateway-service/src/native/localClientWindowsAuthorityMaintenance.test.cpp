#include "localClientWindowsAuthorityMaintenance.h"

#include <algorithm>
#include <array>
#include <iostream>
#include <string>
#include <vector>

using namespace uai_authority_maintenance;

namespace {
void Require(bool condition, const char* message) { if (!condition) throw std::runtime_error(message); }
struct InjectedFailure {};
using StateBytes = std::array<std::string, 5>;
const StateBytes OriginalState = {"fixture-dpapi-blob", "fixture-nonce-ordered-claims", "fixture-file-nonzero-pending",
  "fixture-hklm-type-and-raw-bytes", "fixture-pop-ledger-watermark-and-claims"};

struct Disk {
  Journal journal{Operation::Upgrade, Phase::Intent, 1, 4, 2, false};
  bool disabled = false, running = true, blocked = false, sealed = false;
  bool extended = false, viewsPrepared = false, committed = false;
  std::array<unsigned, kCodeFileCount> code{1, 1, 1, 1, 1, 1, 1};
  StateBytes state = OriginalState, sealedState{};
};

struct FixturePort {
  Disk& disk;
  bool brokerLock = false;
  std::size_t failAt = 0, event = 0;
  std::vector<std::string> trace;

  explicit FixturePort(Disk& value, std::size_t failure = 0) : disk(value), failAt(failure) {}
  void boundary(const std::string& name) {
    trace.push_back(name);
    if (++event == failAt) throw InjectedFailure{};
  }
  template<class Action> void call(const std::string& name, Action action) {
    boundary(name + ":before"); action(); boundary(name + ":after");
  }
  void requireQuiesced() const { Require(disk.disabled && !disk.running && brokerLock, "write outside maintenance barrier"); }
  void ensureDisabled() { call("disable", [&] { Require(!brokerLock, "disable under broker lock"); disk.disabled = true; }); }
  void ensureStopped() { call("stop", [&] { Require(disk.disabled && !brokerLock, "stop before disabled or under broker lock"); disk.running = false; }); }
  void acquireBrokerLock() { call("acquire", [&] { Require(disk.disabled && !disk.running && !brokerLock, "broker lock acquired before process exit"); brokerLock = true; }); }
  void releaseBrokerLock() noexcept { brokerLock = false; }
  void seal() { call("seal", [&] {
    requireQuiesced();
    if (disk.sealed) Require(disk.sealedState == disk.state, "cannot replace prior sealed state");
    else { disk.sealedState = disk.state; disk.sealed = true; }
  }); }
  void blockView() { call("block", [&] { requireQuiesced(); Require(disk.sealed, "block before seal"); disk.blocked = true; }); }
  void replaceCode(std::size_t index) { call("replace-" + std::to_string(index), [&] {
    requireQuiesced(); Require(disk.blocked && index < disk.code.size(), "code outside blocked view");
    Require(disk.code[index] == disk.journal.sourceVersion || disk.code[index] == disk.journal.targetVersion, "unknown code hash");
    disk.code[index] = disk.journal.targetVersion;
  }); }
  void extendPoPState() { call("extend", [&] {
    requireQuiesced(); Require(disk.journal.minPopProtocolVersion == 2, "floor missing before extension"); disk.extended = true;
  }); }
  void prepareTargetViews() { call("prepare-views", [&] { requireQuiesced(); Require(disk.extended, "views before extension"); disk.viewsPrepared = true; }); }
  void verifySealedPreservation() { call("verify-sealed", [&] { requireQuiesced(); Require(disk.sealed && disk.state == disk.sealedState, "protected state changed"); }); }
  void commitViews() { call("commit-views", [&] {
    requireQuiesced(); Require(disk.viewsPrepared, "commit without views");
    Require(std::all_of(disk.code.begin(), disk.code.end(), [&](unsigned version) { return version == disk.journal.targetVersion; }), "mixed code commit");
    disk.committed = true; disk.blocked = false;
  }); }
  void advance(Phase phase) { call("advance-" + std::to_string(static_cast<unsigned>(phase)), [&] {
    requireQuiesced(); disk.journal.phase = phase;
  }); }
  void verifyCommittedView() { call("verify-committed", [&] {
    Require(!brokerLock && disk.committed && !disk.blocked, "committed view unavailable");
    Require(std::all_of(disk.code.begin(), disk.code.end(), [&](unsigned version) { return version == disk.journal.targetVersion; }), "committed code mismatch");
  }); }
  void restoreDemandStart() { call("restore-demand", [&] { Require(!brokerLock && disk.committed, "restore demand before commit/release"); disk.disabled = false; }); }
  void complete() { call("complete", [&] { Require(!disk.disabled && !brokerLock && disk.committed, "premature completion"); disk.journal.phase = Phase::Complete; }); }
  void verifyComplete() { call("verify-complete", [&] {
    Require(disk.journal.phase == Phase::Complete && disk.committed && !disk.disabled, "invalid completed view");
    Require(std::all_of(disk.code.begin(), disk.code.end(), [&](unsigned version) { return version == disk.journal.targetVersion; }), "completed code mismatch");
  }); }
};

void Run(Disk& disk, FixturePort& port) { auto current = disk.journal; Execute(port, current); Require(current.phase == disk.journal.phase, "memory/durable phase disagree after success"); }
void RequirePreserved(const Disk& disk) { Require(disk.state == OriginalState, "coordinator changed existing state"); Require(disk.journal.minPopProtocolVersion == 2, "coordinator lowered floor"); }

void Validations() {
  Journal journal{Operation::Upgrade, Phase::Intent, 1, 4, 2, false};
  Require(IsValid(journal), "v1 upgrade rejected");
  journal.sourceVersion = 2; Require(IsValid(journal), "v2 upgrade rejected");
  journal.sourceVersion = 3; Require(!IsValid(journal), "unadopted v3 accepted");
  journal.operation = Operation::AdoptExistingV3; Require(IsValid(journal), "explicit v3 adoption rejected");
  journal.sourceHasMaintenance = true; Require(!IsValid(journal), "duplicate adoption accepted");
  journal.operation = Operation::Upgrade; Require(IsValid(journal), "maintained v3 upgrade rejected");
  journal.sourceVersion = 4; Require(IsValid(journal), "maintained v4 upgrade rejected");
  journal.sourceHasMaintenance = false; Require(!IsValid(journal), "v4 missing maintenance accepted");
  journal.sourceHasMaintenance = true; journal.operation = Operation::RestoreLegacyV1; journal.targetVersion = 1;
  Require(IsValid(journal), "true v1 restore rejected");
  for (unsigned invalidFloor : {0U, 1U, 3U}) { journal.minPopProtocolVersion = invalidFloor; Require(!IsValid(journal), "unsupported protocol floor accepted"); }
  journal.minPopProtocolVersion = 2; journal.phase = static_cast<Phase>(99); Require(!IsValid(journal), "unknown phase accepted");
  Disk disk; disk.journal = journal; FixturePort port(disk);
  bool rejected = false; try { Run(disk, port); } catch (const std::runtime_error&) { rejected = true; }
  Require(rejected && port.trace.empty(), "invalid journal produced port calls");
  Journal fresh{Operation::FreshInstall, Phase::CommittedStopped, 0, 4, 2, false};
  Require(IsValid(fresh), "committed fresh install rejected"); fresh.phase = Phase::Complete; Require(IsValid(fresh), "complete fresh install rejected");
  fresh.phase = Phase::Intent; Require(!IsValid(fresh), "fresh install entered maintenance creation phases");
  fresh.phase = Phase::Complete; fresh.sourceVersion = 1; Require(!IsValid(fresh), "fresh install adopted existing state");
  fresh.sourceVersion = 0; fresh.sourceHasMaintenance = true; Require(!IsValid(fresh), "fresh install forged source maintenance");
}

void FaultEveryBoundary() {
  Disk happy; FixturePort successful(happy); Run(happy, successful);
  Require(!happy.disabled && !happy.running && happy.journal.phase == Phase::Complete, "happy path did not finish stopped");
  RequirePreserved(happy);
  const auto events = successful.event;
  for (std::size_t failure = 1; failure <= events; ++failure) {
    Disk disk; FixturePort interrupted(disk, failure); bool injected = false;
    try { Run(disk, interrupted); } catch (const InjectedFailure&) { injected = true; }
    Require(injected, "fault boundary not reached");
    Require(!interrupted.brokerLock, "broker lock escaped failure cleanup");
    RequirePreserved(disk);
    if (disk.journal.phase != Phase::CommittedStopped && disk.journal.phase != Phase::Complete) {
      const bool sourceUntouched = std::all_of(disk.code.begin(), disk.code.end(), [](unsigned version) { return version == 1; });
      Require(sourceUntouched || (disk.disabled && !disk.running), "mixed view became startable");
    }
    // Reload the durable journal, including the after-write/before-ack case.
    FixturePort resumed(disk); Run(disk, resumed);
    Require(disk.journal.phase == Phase::Complete && !disk.disabled && !disk.running, "resume failed to complete stopped");
    RequirePreserved(disk);
  }
  std::cout << "fault-boundaries=" << events << '\n';
}

void RefuseUnknownCodeAndChangedState() {
  Disk disk; disk.code[3] = 99; FixturePort port(disk); bool rejected = false;
  try { Run(disk, port); } catch (const std::runtime_error&) { rejected = true; }
  Require(rejected && disk.disabled && !disk.running && disk.blocked && !port.brokerLock, "unknown code did not remain stopped");
  Require(std::none_of(port.trace.begin(), port.trace.end(), [](const std::string& value) { return value == "restore-demand:before"; }), "unknown code restored start type");
  RequirePreserved(disk);

  Disk altered; altered.journal.phase = Phase::ViewsPrepared; altered.code.fill(4); altered.disabled = true; altered.running = false;
  altered.blocked = true; altered.sealed = true; altered.sealedState = OriginalState; altered.state[2] = "changed-during-maintenance";
  altered.extended = true; altered.viewsPrepared = true; FixturePort changed(altered); rejected = false;
  try { Run(altered, changed); } catch (const std::runtime_error&) { rejected = true; }
  Require(rejected && !altered.committed && altered.disabled && altered.state[2] == "changed-during-maintenance", "changed state overwritten or committed");
}

void CommittedResumeDoesNotReplayOldSeal() {
  Disk disk; FixturePort initial(disk); Run(disk, initial);
  disk.journal.phase = Phase::CommittedStopped; disk.running = true;
  disk.state[1] += "-new-legitimate-claims"; disk.state[2] += "-new-generation";
  const auto latest = disk.state; FixturePort resumed(disk); Run(disk, resumed);
  Require(disk.running && disk.state == latest, "committed resume stopped/reverted live state");
  Require(std::none_of(resumed.trace.begin(), resumed.trace.end(), [](const std::string& value) {
    return value == "disable:before" || value == "stop:before" || value == "acquire:before" || value == "verify-sealed:before";
  }), "committed resume re-entered sealed mutation phase");
  FixturePort complete(disk); Run(disk, complete);
  Require(complete.trace.size() == 2 && complete.trace.front() == "verify-complete:before" && disk.state == latest, "complete replay performed mutation");
}

void RestoreAndAdopt() {
  for (const auto operation : {Operation::AdoptExistingV3, Operation::RestoreLegacyV1}) {
    Disk disk; disk.journal = {operation, Phase::Intent, operation == Operation::AdoptExistingV3 ? 3U : 4U,
      operation == Operation::AdoptExistingV3 ? 4U : 1U, 2, operation == Operation::RestoreLegacyV1};
    disk.code.fill(disk.journal.sourceVersion); FixturePort port(disk); Run(disk, port);
    RequirePreserved(disk);
    Require(disk.journal.phase == Phase::Complete && !disk.running, "adopt/restore did not finish stopped");
  }
}
} // namespace

int main() {
  try {
    Validations(); FaultEveryBoundary(); RefuseUnknownCodeAndChangedState(); CommittedResumeDoesNotReplayOldSeal(); RestoreAndAdopt();
    std::cout << "maintenance-coordinator-tests=passed\n"; return 0;
  } catch (const std::exception& error) { std::cerr << "maintenance-coordinator-tests=failed: " << error.what() << '\n'; return 1; }
  catch (...) { std::cerr << "maintenance-coordinator-tests=failed: unexpected exception\n"; return 1; }
}
