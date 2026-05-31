# A. Phase306A Goal And Boundary

Phase306A seals a UI-only redesign for `/ui`.

- Make the page fill the browser viewport.
- Make Chat the primary work area.
- Make `Approved Local Operation Loop` easy to find and use.
- Keep `Local Agent Intent & Approval Preview` visible and reachable.
- Reduce oversized cards, padding, and buttons.

This phase does not add execution capability, does not change provider behavior, does not change the default `/chat` chain, and does not change patch runner, auto review, or permission policy logic.

# B. Current UI Pain Points

- `Approved Local Operation Loop` lived inside the right-side capability drawer and was easy to miss.
- The Chat area was constrained by a centered max width and felt too small for long answers.
- Cards and buttons consumed too much space for daily operator use.
- The page did not make full use of large screens.
- Narrower windows needed better proportional shrinking and fewer overflow risks.

# C. New Layout

The redesigned UI uses a responsive operator-console layout.

- Wide screens: main Chat workspace on the left, operator console on the right.
- Mid-size screens: Chat remains primary, operator console becomes a collapsible side surface.
- Small screens: stacked single-column flow with compact controls and no horizontal overflow.

Top-level shortcuts now expose:

- Chat
- Operator Preview
- Local Agent Intent & Approval Preview
- Approved Local Operation Loop
- Knowledge / RAG
- Health / Status

# D. Chat Panel Expansion

Chat is promoted to the primary reading area.

- The chat shell now uses full available width instead of a narrow centered max width.
- The output region uses a `chat-output` style marker and keeps its own scroll area.
- Long answers, code blocks, and JSON remain readable through internal scrolling and wrapping support.
- The chat panel targets at least half of the usable screen height on larger viewports.

# E. Approved Local Operation Loop Visibility

`Approved Local Operation Loop` is no longer treated as a buried hidden panel on desktop.

- It remains inside the operator console.
- On wide screens the operator console is persistently visible.
- The page adds explicit shortcut links that jump directly to the panel.
- The panel title and safety reminders remain visible and unchanged in meaning.

# F. Module And Button Compaction

The redesign reduces visual bulk without hiding control steps.

- Smaller button height and tighter padding.
- Smaller card padding and badge spacing.
- Tighter action rows for preview / propose / apply / review controls.
- Secondary guidance stays visible but uses lighter, smaller presentation.

# G. Responsive Layout

- Full-screen layout uses viewport-filling structure.
- Wide screens use a split console.
- Small screens collapse to one column and restore the slide-over operator panel behavior.
- The layout avoids horizontal overflow and keeps main scrolling inside the relevant panel.

# H. Forbidden Buttons And Unsafe UI

The redesign must not introduce:

- `full_open` selectable controls
- commit buttons
- push buttons
- deploy buttons
- release buttons
- workspace cleanup buttons
- `git reset` or `git clean` buttons
- automatic whole-repo apply actions

# I. Execution Logic Is Unchanged

Phase306A is presentation-only.

- No new route is required.
- No route behavior is changed.
- No local command execution is added.
- No patch application logic is changed.
- No auto review loop behavior is changed.
- No provider or NVIDIA default chat routing is changed.

# J. User Startup And Usage

- Start the existing service with the project’s current approved startup path.
- Open [http://127.0.0.1:3100/ui](http://127.0.0.1:3100/ui).
- Use the top shortcut strip or the right-side operator console shortcuts.
- Read and work in Chat on the left.
- Use `Local Agent Intent & Approval Preview` for read-only preview.
- Use `Approved Local Operation Loop` only through the existing approved Phase303A-305A flow.

# K. Capabilities That Must Not Be Claimed

Do not describe Phase306A as:

- new execution support
- new patch apply support
- new auto review support
- provider upgrade
- `/chat` behavior rewrite
- full-open enablement
- release, deploy, commit, or push automation
- workspace clean confirmation

# L. Suggested Next Direction

Reasonable future follow-up after Phase306A:

- small usability polish for panel density and typography
- optional panel pinning and collapse memory
- finer-grained operator dashboard grouping

Phase307A or any later phase is not executed here.

# M. Phase306B Manual Visibility Hotfix

Phase306B is a UI-only visibility hotfix on top of Phase306A.

- The first screen must show `Local Agent Intent & Approval Preview` in the main content area.
- The first screen must show `Approved Local Operation Loop` in the main content area.
- These panels must not exist only as a side-panel copy.
- The hotfix may tighten anchors, headings, and layout density, but it does not add execution capability.
- The hotfix does not change `/chat`, provider behavior, patch runner behavior, auto review behavior, or permission policy.
- The hotfix does not introduce `full_open`, commit, push, deploy, or release controls.
- The layout remains responsive and full-screen, and the workspace dirty state is still informational only.
