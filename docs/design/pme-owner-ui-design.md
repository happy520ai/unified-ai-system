# PME Owner UI Design

phaseRange: Phase1801-1820AIO

## Design Direction

PME Owner UI is a calm local operator dashboard for one person using the system on their own machine. It should feel like a finished product surface, not an engineering console.

The owner first sees one dominant action and three result cards:

- Today completed
- Problems found
- Next action

Engineering details remain available behind Advanced Mode, but they should not compete with the owner workflow.

## Visual Tokens

- Surface: white and near-white local dashboard backgrounds.
- Accent: restrained blue for the one primary action and next step.
- Success: soft green for completed checks.
- Warning: soft amber for problems and attention.
- Radius: 8px for cards and buttons.
- Typography: local system fonts only, with Microsoft YaHei / Segoe UI fallback.

## Components

- `OwnerPrimaryAction`: one full-width primary CTA with a short reassurance line.
- `OwnerStatusCard`: shared card shell for the three core owner results.
- `ownerDesignTokensCss`: scoped owner tokens used by Owner Home.

## Report Design

The owner daily report mirrors the same hierarchy:

1. 今天完成了什么
2. 发现了什么问题
3. 下一步我该做什么
4. 高级信息

Advanced evidence paths stay at the bottom and never appear as the main user task.

## Safety Boundary

- Provider calls remain false.
- `/chat` remains unchanged.
- `/chat-gateway/execute` remains unchanged.
- No deploy, release, tag, artifact upload, commit, or push is performed.
- This is local self-use UI polish, not production readiness.

