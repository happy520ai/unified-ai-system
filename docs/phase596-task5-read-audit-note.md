# Phase596 Task 5 Read Audit Note

The read audit records expected reads and actual read preview for every benchmark task. Expected reads include `.codex-context` files, `relevant-files.json` entries, and the Phase596 docs/evidence/tools outputs.

The audit records out-of-scope reads with a reason. For example, runtime files such as `apps/ai-gateway-service/src/httpServer.js` remain out of scope because Phase596 does not modify runtime behavior.

The benchmark uses this audit to prove that repeated tasks did not default to a full repository scan.
