# Phase638R How To Disable Nightly Runner

## Disable

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/phase638r/unregister-nightly-windows-task.ps1
```

This removes `PME-AI-Gateway-Nightly-Safe-Runner`.

## What It Does Not Do

- It does not delete evidence.
- It does not delete docs.
- It does not run `git reset`.
- It does not run `git clean`.
- It does not touch secrets or Codex config.
