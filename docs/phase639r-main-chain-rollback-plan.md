# Phase639R Main-Chain Rollback Plan

## If A Future Candidate Misbehaves

- disable main-chain candidate flag
- restore preview-only mode
- preserve evidence
- keep `/chat` unchanged unless a future approved implementation phase has explicitly modified it
- keep `/chat-gateway/execute` unchanged unless a future approved implementation phase has explicitly modified it
- remove future main-chain candidate references from Mission Control preview if needed

## Prohibited Rollback Shortcuts

- no git reset --hard
- no git clean
- no evidence deletion
- no auth.json access
- no secret exposure

