# Phase302A UI-ready Intent Explanation & Approval Preview

## A. Phase302A goal and boundary
Phase302A adds the UI-ready read-only layer that explains local operation intent and approval preview data inside `/ui`.
It does not apply patches, run review loops, execute local commands, read `.env`, call providers, or change the `/chat` mainline.

## B. Upstream dependencies
This phase depends on Phase294A, Phase295A, Phase296A, Phase297A-298A, Phase299A, and Phase301A.
It assumes the local intent classifier, permission-mode gate, read-only runner boundary, approved patch / auto review boundary, operator preview panel, and chat-to-local-agent preview already exist.

## C. User flow
1. The user opens `/ui`.
2. The user enters a local operation request.
3. The system classifies the intent.
4. The system explains risk and approval points.
5. The system recommends a permission mode.
6. The system shows `allowedFilesRequired`, allowed commands, blocked commands, and forbidden paths.
7. The system returns only preview data.

## D. Permission mode selection
The preview may recommend `manual` or `auto_review`.
`full_open` remains disabled and is not a selectable mode.
The recommendation is advisory only and does not grant execution permission.
Full-open disabled.
full-open disabled.

## E. allowedFilesRequired rule
`allowedFilesRequired` is always true in this phase.
The phase does not apply patches and does not need a filled `allowedFiles` list yet.
The preview explains that later write-capable phases will require explicit allowed files.

The preview also shows `allowedCommands`, `blockedCommands`, and `forbiddenPaths` so the user can see the full safety boundary.

## F. Patch proposal / diff preview rule
This phase does not generate or apply a patch proposal.
It only explains the request and the approval boundary that later phases will use.

## G. Approval preview rule
The approval preview is read-only metadata.
It records the preview state, approval points, permission-mode guidance, and file / command boundaries.
It is not an approval record and it does not authorize execution.

## H. Real apply patch safety gate
Real patch apply is out of scope for Phase302A.
The phase only prepares the UI-ready explanation layer that later phases can use.

## I. Auto Review Loop white-list rule
Auto Review Loop is out of scope for Phase302A.
The preview may describe the future boundary, but it does not run verification commands or retry loops.

## J. go / no-go / review-required rule
Phase302A remains preview-only and does not emit go / no-go / review-required execution results.
Those labels belong to later stages that can safely act on a real approval record.

## K. Rollback manifest rule
Rollback manifest generation is out of scope for Phase302A.
Later phases may use the preview to decide when a rollback manifest must be written.

## L. Failure-stop rule
The phase stops at preview.
No automatic repair, no endless loop, and no hidden execution path is allowed.

## M. Forbidden operations
The phase must not enable `full_open`.
The phase must not commit, push, deploy, or release.
The phase must not touch legacy code, `.env`, or `PROJECT_CONTEXT.md`.
No commit / push / deploy / release is allowed here.
.env / secrets blocked.
legacy/ blocked.
Workspace dirty does not mean clean.

## N. UI usage
Open `/ui` and use the `Local Agent Intent & Approval Preview` panel.
Enter a local operation request and click `Preview Intent`.
The panel shows the intent classification, risk explanation, recommended permission mode, approval points, command boundary, forbidden paths, and next-step advice.

## O. HTTP route usage
`POST /agent-runner/intent-approval-preview` accepts a JSON body with `input`.
The route returns preview-only intent explanation and approval preview data.
It does not apply patches, run review loops, or execute commands.

## P. Capability limits
This phase does not claim patch application support.
It does not claim approval approval, execution approval, or local command execution.
It does not claim provider access, workflow runner access, worktree creation, or release / deploy support.

## Q. Suggested next phase
Phase303A can build the approved local operation loop on top of this preview layer.
That later phase should add explicit approval records, allowed-files enforcement, patch proposal generation, and bounded auto review.
