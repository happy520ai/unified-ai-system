# Phase639R Provider Runtime Rollback Plan

## If A Future Provider Runtime Candidate Misbehaves

- disable provider runtime candidate flag
- restore preview-only mode
- preserve evidence
- keep provider runtime main chain unchanged unless a future approved implementation phase has explicitly modified it
- remove future provider runtime candidate references from Mission Control preview if needed

## Prohibited Rollback Shortcuts

- no git reset --hard
- no git clean
- no evidence deletion
- no auth.json access
- no secret exposure
- no Provider call

