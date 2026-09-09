# Windows authority preserving maintenance

The v4 package adds explicit, pinned maintenance for an existing authority installation. It can upgrade a verified v1 or v2 installation, explicitly adopt an existing v3 installation, upgrade a maintained v4 installation, and restore the original v1 program and metadata views in a restricted legacy mode. These commands are not executed by the gateway, application startup, or package builder.

The implementation and offline checks do not establish successful Windows installation, SCM restart, DPAPI recovery, crash durability, or production operation. Real host acceptance must run separately with scoped authorization.

## Commands and pins

Run the v4 host executable from a verified external package. Both source and target packages must retain their exact seven artifacts and manifest. The installation ID is the original 32-character ID. `--expected-source-manifest-sha256` and `--expected-manifest-sha256` are SHA-256 digests of the exact source and target manifests, respectively. They are mandatory for maintenance previews as well as apply operations.

```powershell
& '<external-v4-package>\bin\authority-broker-host.exe' `
  --upgrade --source-package '<installed-version-package>' `
  --expected-source-manifest-sha256 '<source-sha256>' `
  --package '<target-v4-package>' --expected-manifest-sha256 '<target-sha256>' `
  --installation-id '<original-installation-id>' --check-only
```

Replace `--check-only` with `--apply --yes` only for an explicitly authorized maintenance operation. Apply requires elevation and the same original operator SID bound in the existing bootstrap. A different administrator cannot replace that binding during resume. Package verification never overrides installation identity, root file identity, service account/SID, ACL, retained state, or manifest conflicts.

Use `--adopt-existing-v3` instead of `--upgrade` when the source is the T047 v3 package and has no maintenance record. Ordinary upgrade deliberately rejects that case. The adoption checks both existing PoP checkpoints and the existing protected PoP nonce ledger; it does not create replacements for missing or damaged v3 objects.

Use `--resume` with the same operation, installation ID, packages, and pins to continue an interrupted recorded transaction. Resume proceeds toward that recorded target. Switching targets or restoring older logical state during an incomplete transaction is rejected. No maintenance command automatically starts the service.

## Preserved state and fixed changes

Maintenance preserves the following objects and checks their hashes while the service is stopped and the broker mutex is held:

- The original twelve runtime/validation anchor files, their file and directory ACLs, all four checkpoint fields including pending state, and the exact HKLM registry64 value bytes/type and key ACLs.
- The dedicated DPAPI integrity-key blob and the full ordered legacy nonce file. The helper only decrypts the existing key in memory to verify or sign a checkpoint; it never returns the key.
- Every already-owned PoP checkpoint and its HKLM counterpart, plus the existing encrypted PoP ledger, service-instance binding, nonce records, and UTC high-water mark.
- The original installation ID, host ID, root file identity, operator SID, service name, service SID/account, and fixed service image path.

The retained checkpoint helper verifies HMACs, binding, exact checkpoint shape, generation/digest consistency, and file/HKLM equality. Pending checkpoints are retained without finalize, rollback, or automatic recovery. A seal mismatch stops maintenance.

The external helper's five-file `bin` directory rejects extra files or subdirectories, while verified artifact handles remain pinned. Its new child process must enable and read back the Windows `PreferSystem32Images` policy before private input is sent. This addresses system-DLL imports such as `dbghelp.dll` beside a supplied Node executable; unsupported or unconfirmed policy fails closed. See Microsoft's [process image-load policy](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-process_mitigation_image_load_policy) and [process-creation attributes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute).

Only the seven pinned program/license artifacts and the bootstrap/ownership views are replaced. Fresh v1 upgrade may create exactly two PoP slots and one PoP ledger after verified absence. An unmaintained v1 installation with pre-existing PoP objects is a conflict. An unmaintained v2 installation retains its two PoP slots and may create only the absent ledger. A v1 installation previously restored by this tool must retain all PoP objects and the protocol floor when upgrading again.

The first two new checkpoints are signed through the existing TypeScript file-HMAC protocol. The original twelve are never re-signed. New files are fully written, flushed, and read back in an owned temporary file before publication without replacement. A partially created new registry key is resumed only inside the transaction's recorded new namespace and only if it is empty or contains the exact zero checkpoint. A conflicting or nonzero value is not reset.

## Journal, service ordering, and interruption

The separate private `maintenance.json` records the transaction ID, source/target versions and pins, exact metadata hashes, a sealed-state digest, and minimum PoP protocol version 2. The old `installation.json` remains the exact seven-field v1 ownership format. This separation is necessary for genuine old-binary compatibility.

The fixed private `maintenance.lock` serializes maintenance before any SCM change. Check-only does not create this file or a journal. A private `maintenance/<transaction-id>` directory contains only owned metadata/code spools and sealed hashes, not copies of retained keys, databases, nonce files, or checkpoint values. The original v1 bootstrap and ownership metadata are separately retained for a future restricted restore. Obsolete transaction metadata is not automatically deleted.

The production driver invokes the same bounded coordinator exercised by the offline C++ tests:

1. Persist the pinned intent and protocol floor. Disable demand-start, request stop, observe SCM `STOPPED` and the former process exit, then acquire the existing broker mutex.
2. Seal the retained state. Bind the seal digest into the journal before advancing. Publish ownership `preparing` so old binaries cannot serve a mixed installation.
3. Replace each of the seven artifacts, accepting only the pinned source or target hash on resume. Unknown code stops the transaction.
4. Create only authorized new PoP objects; verify all actual final checkpoint files/HKLM values through the private helper and recheck every retained seal.
5. Publish the exact target bootstrap and installed ownership views, then commit the journal. The v4 service refuses startup until its committed maintenance record matches its actual metadata and package pin.
6. Release the mutex, verify the committed view, restore demand-start, and persist completion. An unconfirmed mutex release prevents demand-start restoration.

Each metadata publication uses a complete owned spool, `FlushFileBuffers`, `MoveFileExW` with write-through, final flush, and readback. Failures leave the transaction available for checked forward resume; no fallback erases or recreates retained authority state. If demand-start was already restored before a lost completion reply, legitimate newer runtime state may exist. Resume then verifies the committed code and metadata, and does not compare against or restore the older stopped-state seal.

The final recorded v4 fresh-install publication window has a separate `--resume-fresh-install` operation with the package pin and original installation ID. It completes only an existing `FreshInstall` committed/completed record; it does not recreate missing key, checkpoint, nonce, or ledger objects. Earlier unrecorded fresh-installer failures retain the existing conflict/rollback behavior and are outside preserving-upgrade resume.

## Restricted original v1 restore

After a completed v1-to-v4 upgrade, use the same command shape with `--restore-legacy-v1`, source equal to the current v4 package, and target equal to the originally retained v1 package:

```powershell
& '<external-v4-package>\bin\authority-broker-host.exe' `
  --restore-legacy-v1 --source-package '<current-v4-package>' `
  --expected-source-manifest-sha256 '<current-v4-sha256>' `
  --package '<original-v1-package>' --expected-manifest-sha256 '<original-v1-sha256>' `
  --installation-id '<original-installation-id>' --check-only
```

This restores the real seven v1 artifacts, the original exact six-field bootstrap, and the original exact seven-field installed ownership view. The old v1 host can therefore parse its own original twelve-slot view. Its code does not expose the PoP slots or PoP request-v2 capability. The maintenance record, minimum protocol version 2, both PoP slots, protected PoP ledger, and their current values remain present. Re-upgrade must preserve them.

Restoring bootstrap metadata does not restore a historical receipt/workcopy checkpoint or nonce state. The original twelve checkpoints and legacy nonce file keep their current contents. A later v1 bootstrap or request can append new legacy nonces; stopped-state byte equality is not a claim that those bytes remain unchanged after service calls.

Restore requires the original retained v1 views. A fresh v4 installation or a v3 adoption without those views cannot fabricate an original v1 rollback. The old `--rollback` command still removes owned service/code registration while retaining authority state; it is not this restricted original-binary restore.

## Verification and remaining host acceptance

Run the credential-free coordinator tests without loading the native addon or touching SCM:

```powershell
node tools/build-local-client-windows-authority.mjs --maintenance-tests `
  --output '<new-directory-under-approved-evidence-or-E:\Codex\validation>'
```

The tests exercise the production coordinator, inject failures before and after each modeled port boundary, reload the durable journal, verify lock/stop ordering and retained values, reject unknown code and changed seals, cover restricted restore and explicit v3 adoption, and preserve legitimate newer state after a committed transaction. TypeScript helper tests cover nonzero and pending checkpoints, tampering, exact slot sets, fixed two-slot signing, and bootstrap-version compatibility. Object/package builds verify the Win32 driver compiles; neither build loads or installs it.

Independent host acceptance remains necessary for actual process exit, service start, object ACLs, DPAPI, registry64 raw bytes, power loss around every durable write, same-instance and restarted request replay, original v1 binary startup, legacy-only PoP refusal, re-upgrade, and runtime timing. Retain the first failing evidence and do not replace it with a later passing run. The original twelve-slot v1 permanent nonce capacity remains unchanged; PoP lifecycle tests do not remove that legacy limit.

## Language Selection and scope

The workload is a Windows installation transaction whose correctness depends on SCM ordering, native object identity, DPAPI, registry64, ACLs, flush/readback, and the existing broker mutex. C++ remains appropriate for that driver and the bounded coordinator because it already owns those operations. Rewriting them in TypeScript or PowerShell would add a second authority boundary and would not improve compatibility. TypeScript remains responsible for bootstrap contracts and the existing HMAC/checkpoint semantics; the offline builder remains Node.js ESM.

The implementation necessarily exceeds the 500-line review threshold and adds one protected maintenance record with bounded transaction metadata. It stays within eight product files, adds no dependency, service, database, network path, or general-purpose installer framework, and does not modify the original v1 nonce implementation. The compatibility cost is the explicit v4 package/bootstrap distinction and a required committed record before v4 service startup. Operational recovery is checked forward resume or a completed, reviewed original-v1 restore; copying old logical-state snapshots, deleting the floor, or replacing the key is not a rollback method.
