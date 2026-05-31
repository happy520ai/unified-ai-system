# A. Phase308A Goal And Boundary

Phase308A rebuilds `/ui` into a desktop-grade bilingual AI Gateway Workbench. It is UI final hardening only: no backend capability change, no `/chat` default behavior change, no provider behavior change, no agent-runner execution logic change, no patch runner change, no auto review behavior change, no full-open, no commit, no push, no deploy, and no release.

# B. Current UI Failure Reasons

The previous UI still felt like a long-scroll engineering dashboard. Chat was visually crowded by roadmap, phase, evidence, and setup material. Local Agent actions looked like fields instead of a guided workflow. Inspector content was too broad and debug-like. Users could not immediately tell where to chat, search, use Knowledge / RAG, use Local Agent, approve work, repair safely, find help, or diagnose status.

# C. Codex Desktop / IDE Workbench Principles

The new IA follows a desktop workbench pattern: global bar, left sidebar navigation, single active main page, fixed chat composer, and a simplified right inspector. The first impression should be an IDE-style product console, not a debug page.

# D. Bilingual Switch Design

The UI defaults to `zh-CN` and supports `en-US`. The language switcher is in the global bar. The selected language is persisted in `localStorage` under `aiGatewayWorkbenchLanguage`.

# E. i18n Coverage

The centralized `WORKBENCH_I18N` dictionary covers the global bar, sidebar, project area, Chat, Search, Knowledge, Models / Plugins, Local Agent, Approvals, Repair Center, Help / Runbook, Settings, Diagnostics, Inspector, labels, placeholders, status text, blocked guidance, safety text, and next-step copy.

# F. Page Navigation Design

Each main page uses `data-workbench-page`: `chat`, `search`, `knowledge`, `models`, `local-agent`, `approvals`, `repair`, `help`, `settings`, and `diagnostics`. Sidebar controls use `data-workbench-nav`. The selected page is highlighted and reflected in the URL hash.

# G. Command Search Design

Command Search is a local command palette. It opens from the global search entry and lists Chat, Knowledge, Local Agent, Repair Center, Help, and Diagnostics. Selecting an item switches pages. It does not add backend search or external calls.

# H. Chat Page Design

Chat is clean and primary. It includes a large message area, fixed bottom composer, file button, plugin shortcut, model selector, send button, model status, safety status, and lightweight routes to Local Agent and Repair Center. Product roadmap, setup wizard, phase history, and evidence lists are not in Chat.

# I. Models / Plugins Page Design

Models / Plugins is independent from Chat. It groups Providers, Plugins, MCP, and Skills as product entries without adding new provider behavior or execution ability.

# J. Local Agent Page Design

Local Agent is presented as an 8-step workflow: describe task, preview intent, choose mode, set allowedFiles, generate patch proposal, approve apply, run auto review, and review go/no-go. Existing Preview Intent, Generate Patch Proposal, Approve Apply, Run Auto Review, and Stop / Reset entries are retained with safety gates.

# K. Approvals / Runs Page Design

Approvals / Runs has dedicated status for pending approvals, current run state, recent go/no-go, approvalRecord, allowedFiles, rollback, and evidence entry points. It adds no backend capability.

# L. Repair Center Design

Repair Center explains that every repair must pass through intent preview, approval, allowedFiles, patch proposal, rollback manifest, auto review, and go/no-go. It does not provide one-click full-repo repair, workspace cleanup, git reset, git clean, commit, push, deploy, or release.

# M. Help / Runbook Design

Help / Runbook includes how to chat, use Knowledge / RAG, use Local Agent, fill allowedFiles, understand Manual Approval Mode, understand Auto Review Mode, why full-open is disabled, how to repair safely, how to read go/no-go, and common questions.

# N. Inspector Simplification

The right Inspector keeps only four cards: Current Task, Safety Boundary, Approval & Files, and Evidence / Rollback. It avoids large JSON blocks and old governance/debug panels.

# O. Diagnostics Demotion Strategy

Legacy Product Console, Product Deep Optimization Roadmap, Phase history, Evidence lists, Enterprise Governance, Setup Wizard, and old product cards are demoted to Diagnostics. They do not own the first screen.

# P. Visual Hard Rules

The rebuild reduces green-card clutter, repeated titles, chip noise, heavy borders, and long debug sections. Buttons are compact and consistent. The main page has two to three visual priorities, and the layout fills the viewport on desktop while collapsing responsively on smaller screens.

# Q. Safety Forbidden Items

The UI and launcher must not introduce full_open selection, commit buttons, push buttons, deploy buttons, release buttons, workspace cleanup, git reset, git clean, one-click full-repo apply, one-click full-repo repair, or all-repo default allowedFiles.

# R. README / AGENTS Managed Block Sync Rule

After Phase308A, `sync:readme-agents-current-state` and `verify:phase306c-readme-agents-auto-sync-guard` must run. README.md and AGENTS.md may only be updated through managed blocks.

# S. Runtime UI Smoke

`smoke:phase308a-desktop-workbench-ui` performs a runtime HTML smoke against `http://127.0.0.1:3100/ui?ts=phase308a-smoke` when the service is reachable. If the service is not running, it records `skipped` and does not claim runtime verification.

# T. Execution Logic Is Unchanged

Phase308A does not modify `httpServer.js`, providers, routing, chat defaults, NVIDIA adapter, agent-runner logic, patch runner, auto review, release, deployment, or legacy code.

# U. User Startup And Usage

Start with `cmd /c pnpm run dev:phase7b`, then open `http://127.0.0.1:3100/ui`. Windows users can run `tools/windows/start-ai-gateway-workbench.cmd` or create the desktop shortcut with `cmd /c pnpm run create:desktop-workbench-shortcut`.

# V. Manual Visual QA Checklist

Check that the page looks like a desktop workbench, defaults to Chinese, switches to English, persists language, left navigation switches pages, Command Search opens and selects pages, Chat is clean, Local Agent is workflow-like, Repair Center is safe, Help teaches usage, Inspector is simple, Diagnostics holds old modules, no dangerous buttons exist, and there are no dead buttons.

# W. Capabilities That Must Not Be Claimed

Do not claim production-ready, clean workspace, public release, deployment, automatic commit/push/deploy/release, full-open, external provider execution, workflow runner, worktree, or real Codex exec.

# X. Suggested Next Direction

If users still report confusion after Phase308A, run a separate visual QA phase with screenshots and task-based usability notes. Do not start that phase automatically.
