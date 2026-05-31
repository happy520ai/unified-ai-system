# Phase328A Execution Report

## Scope

- added `POST /three-mode/execute`
- added Three Mode runtime modules
- embedded Three Mode UI into Workbench quick chat page
- preserved existing `/chat-gateway/execute`

## Runtime

- normal mode: single selectable NVIDIA model call
- god mode: multi-model drafts + critic note + supervisor synthesis
- tianshu mode: heuristic planning + routing preference selection + optional God escalation

## UI

- tabs visible for normal / god / tianshu
- mode-specific inputs and result panels present
- audit trace and runtime safety badge present

## Safety

- no legacy change
- no PROJECT_CONTEXT.md
- no secret read or output
- non-NVIDIA real calls remain gated

## Verification

- static `node --check` passed for modified runtime and UI files
- frontend UI smoke executed
- normal runtime smoke: pass
- god runtime smoke: pass
- tianshu runtime smoke: pass
- frontend UI smoke: pass
- `verify:phase321a-workbench-product-recovery`: pass
- `verify:phase107a-secret-safety`: pass
- `pnpm -r --if-present check`: pass
- `verify:phase322a-workbench-chat-gateway-real-nvidia`: pass

## Evidence

- `apps/ai-gateway-service/evidence/phase328a/three-mode-normal-runtime-smoke.json`
- `apps/ai-gateway-service/evidence/phase328a/three-mode-god-runtime-smoke.json`
- `apps/ai-gateway-service/evidence/phase328a/three-mode-tianshu-runtime-smoke.json`
- `apps/agent-console/evidence/phase328a/three-mode-ui-smoke.json`

## Runtime notes

- real calls were observed on the NVIDIA baseline
- non-NVIDIA real calls remained blocked by governance
- existing `/chat-gateway/execute` remained in place
