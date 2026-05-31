# Phase596 Task 7 Operator Checklist Note

The operator checklist for repeated usage is: refresh context pack, confirm stale=false, confirm token budget respected, review relevant files, review prompt pack, scope the task, run validation, review evidence, and do not claim workspace clean.

This checklist is meant for Workbench and Mission Control operators before repeated Codex tasks. It makes the workflow visible and auditable without turning the preview into a real Codex integration.

The checklist also keeps the safety boundary explicit: no Provider call, no secret read, no webhook read, no Codex config or base_url modification.
