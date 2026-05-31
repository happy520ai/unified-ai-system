# A. Phase307A Goal And Boundary

Phase307A rebuilds `/ui` into an AI Gateway Workbench product console. The work is UI and product UX only: no route change, no `/chat` default change, no provider behavior change, no agent-runner execution change, no patch runner change, and no auto review behavior change.

# B. Current UI Problems

The previous page behaved like a long engineering debug dashboard. Chat was pushed down, Local Agent controls were hard to discover, old phase and roadmap cards competed with the real task flow, and the right operator panel felt disconnected from the main workspace.

# C. Workbench Information Architecture

The new structure follows an IDE-style console: top product/status bar, left navigation, central main workspace, and right Inspector context panel. Chat, Knowledge, Models, Local Agent, Approvals, Repair Center, Help, Settings, and Diagnostics are separate navigation destinations instead of one long undifferentiated page.

# D. Left Navigation Design

The left navigation exposes Chat, Knowledge / RAG, Models / Providers, Local Agent, Approvals / Runs, Repair Center, Help / Runbook, Settings, and Health / Diagnostics. It is fixed on wide screens, compact on medium screens, and horizontal on smaller screens.

# E. Middle Workspace Design

The middle workspace starts with a compact workbench home section and then the primary Chat workspace. Local Agent, Repair Center, Help, Settings, and Diagnostics are visible as product pages below the primary workspace instead of being hidden behind historical engineering content.

# F. Right Inspector Design

The right Inspector shows the current task context, permission mode, approval record requirement, allowedFiles requirement, blockers, evidence, rollback, and safety boundaries. The actual Intent Preview and Approved Operation Loop controls remain there for fast operator use.

# G. Chat Primary Workspace

Chat is promoted to the main workspace and remains large enough for long outputs. The message area scrolls internally, and the composer remains attached to the Chat shell. Chat no longer has to carry every product feature.

# H. Local Agent And Approved Operation Loop Productization

The Local Agent area now shows a clear step flow: Describe task, Choose mode, Set allowed files, Preview intent, Generate patch proposal, Approve apply, Run auto review, and Go / no-go result. The existing controlled operation panel still provides the real UI controls and preserves the original safety gate.

# I. Intent Preview Productization

Intent Preview is presented as the safety entry before any local operation. It surfaces intentType, riskLevel, recommendedPermissionMode, approval needs, blockers, forbidden paths, allowed commands, blocked commands, and next-step advice.

# J. Repair Center

Repair Center is visible as a product destination, but it only routes the user into the controlled Local Agent flow. It does not add one-click full-repo repair, workspace cleanup, git reset, git clean, commit, push, deploy, or release behavior.

# K. Help And Runbook

Help / Runbook explains Chat, Knowledge / RAG, Local Agent, Approved Operation Loop, allowedFiles, Manual Approval Mode, Auto Review Mode, why Full-open is disabled, safe repair, and common questions.

# L. Legacy Module Demotion

Product Console, roadmap, historical phase cards, evidence panels, enterprise governance cards, setup wizard content, and advanced engineering views are demoted under System Overview / Diagnostics and no longer own the first screen.

# M. Responsive Layout

Wide screens use left navigation, central workspace, and right Inspector. Medium screens compact the left navigation and allow the Inspector to collapse. Small screens stack the layout without horizontal overflow.

# N. Forbidden Buttons And Unsafe UI

The UI must not expose full-open selection, commit, push, deploy, release, workspace cleanup, git reset, git clean, one-click full-repo apply, or one-click full-repo repair.

# O. Execution Logic Is Unchanged

Phase307A does not change routes, providers, chat defaults, permission policy, approved patch runner, auto review behavior, or local operation execution logic.

# P. User Startup And Usage

Start the local service with `cmd /c pnpm run dev:phase7b`, then open `http://127.0.0.1:3100/ui`. Use the left navigation to move between Chat, Local Agent, Repair Center, Help, and Diagnostics.

# Q. Visual QA Checklist

The first view should look like a product console, not a debug page. The left navigation should be obvious, Chat should be the main workspace, the right Inspector should show task context, Local Agent should show a clear workflow, Help and Repair Center should be discoverable, and old engineering panels should be secondary.

# R. Capabilities That Must Not Be Claimed

Do not claim production readiness, clean workspace, enabled full-open mode, automatic commit/push/deploy/release, public multi-user release, or new execution capability from this UI rebuild.

# S. Suggested Next Direction

Future work can add richer client-side tab state, search filtering, and Inspector state binding. Do not begin Phase308A without explicit user approval.
