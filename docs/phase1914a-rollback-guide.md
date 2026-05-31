# Phase1914A Rollback Guide

Rollback target:
- delete the exact Phase1914A-created Desktop files only
- remove `docs/phase1914a-*.md`
- remove `tools/phase1914a/`
- remove `apps/ai-gateway-service/evidence/phase1914a/`
- remove Phase1914A scripts from `package.json`

Rollback rule:
- do not scan Desktop
- do not delete any file outside the exact Phase1914A-created set
