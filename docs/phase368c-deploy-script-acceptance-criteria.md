# Phase368C Deploy Script Acceptance Criteria

- Must bind to one explicit deployment target.
- Must produce redacted evidence and capture exit code.
- Must define rollback path and post-deploy smoke path.
- Must not inline secrets or dump environment values.
- Must remain gated by final manual deploy execution confirmation.
