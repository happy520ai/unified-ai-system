# A. Phase308B Goal

Phase308B recovers the Workbench from a desktop shell into a useful product surface. It restores model configuration as a first-class entry, improves Chinese-first UX, fills empty pages with user guidance, makes Repair Center actionable without unsafe shortcuts, rewrites Help as a real runbook, and localizes the Inspector.

# B. Phase308A Remaining Problems

Phase308A created the Workbench shell and page switching, but screenshot review still showed product gaps:

- Model configuration was too weak for a core AI Gateway feature.
- Knowledge, Models, Approvals, and Settings still felt like placeholders.
- Chinese mode still contained large English sentences.
- Help did not explain what the system is or how to use each module.
- Repair Center did not tell the user how to start a safe repair.
- Inspector still felt like debug metadata.
- Some buttons had technical handlers but unclear user outcomes.

# C. Model Configuration Restoration

Model configuration is restored as a primary path:

- The left navigation keeps Models / Plugins as a first-level page.
- Chat header and Chat composer include Configure model / 配置模型.
- Settings includes a model configuration entry.
- Models explains current model state, Provider boundaries, default `/chat` lane, NVIDIA/free/paid provider boundaries, API Key safety, Base URL, and Model ID.
- Test connection is visible but disabled with a clear reason because this phase adds no backend handler.

# D. Chinese Experience Fix

The visible Chinese mode is Chinese-first across the Global Bar, Sidebar, Chat, Knowledge, Models, Local Agent, Approvals, Repair Center, Help, Settings, Diagnostics, Inspector, buttons, placeholders, empty states, next steps, and disabled reasons.

Allowed technical terms remain visible where useful: API, RAG, Provider, Local Agent, allowedFiles, dryRun, go/no-go, evidence, rollback, token, JSON, Git, MCP, and NVIDIA.

# E. Useful Page Design

Every main page now answers:

- What is this page for?
- What can I do here?
- What should I click next?

Knowledge explains RAG and the no-embedding/no-external-provider boundary. Models explains model configuration. Approvals explains approvalRecord, allowedFiles, rollback, evidence, and go/no-go. Settings explains language, model entry, desktop launcher, and safe defaults. Diagnostics explains why old engineering material lives there.

# F. Repair Center Safe Repair Button

Repair Center includes a primary Start Safe Repair / 开始安全修复 button. It does not run a repair directly. It only:

- Switches to Local Agent.
- Fills a safe repair request template.
- Focuses and highlights the allowedFiles field.
- Shows the instruction to fill allowedFiles before previewing intent.

It does not apply patches, approve records, run commands, or bypass review.

# G. Help / Runbook System Manual

Help is rewritten as a real system manual:

- What AI Gateway Workbench is.
- New user three-step start.
- What each module does.
- How Local Agent works.
- How to fill allowedFiles.
- What Manual Approval Mode and Auto Review Mode mean.
- Why full-open is disabled.
- How to repair safely.
- FAQ for disabled buttons, allowedFiles, commit/push/deploy restrictions, desktop launcher, and language switching.

# H. Inspector Localization And Context

Inspector now uses localized labels and page-aware task guidance. It changes context for Chat, Knowledge, Models, Local Agent, Approvals, Repair, Help, Settings, and Diagnostics.

# I. Empty State Design

Empty states now explain:

- There is no current data.
- What the area is for.
- What to do next.

Approvals explicitly says there is no pending approval and directs the user to Local Agent.

# J. Button QA Enhancement

Buttons are either navigational, wired to existing handlers, wired to existing routes, disabled with a visible reason, or static explanatory controls such as details sections. Start Safe Repair has a clear behavior. Configure Model navigates to Models. No fake `href="#"` entries are introduced.

# K. Safety Boundary

The phase keeps these boundaries:

- full-open disabled.
- No commit / push / deploy / release.
- No `.env` or secrets reads.
- `legacy/` remains blocked.
- `PROJECT_CONTEXT.md` remains prohibited.
- workspace dirty is not clean.

# L. No New Execution Capability

This phase changes UI, copy, local front-end interactions, verifier, evidence, and docs only. It does not modify backend routes, provider logic, `/chat` default behavior, agent-runner execution, patch runner, or auto review behavior.

# M. Acceptance Checklist

- Model config is easy to find from Chat, top bar, Settings, and sidebar.
- Chinese mode is readable and Chinese-first.
- Every page has purpose, actions, and next step.
- Repair Center has Start Safe Repair and no unsafe shortcut.
- Help explains the system end-to-end.
- Inspector is localized and contextual.
- Empty states are meaningful.
- Button QA reports zero dead buttons.
- Phase308B verifier passes.

# N. Capabilities That Must Not Be Claimed

Do not claim production readiness, clean workspace, new provider execution, new backend model configuration, auto repair, full-open, automatic commit/push/deploy/release, or any Phase309A work.
