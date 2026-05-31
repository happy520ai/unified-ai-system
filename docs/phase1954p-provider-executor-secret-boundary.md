# Phase1954P Provider Executor Secret Boundary

The executor boundary remains strict:

- Raw provider secret values are not accepted.
- `auth.json` is not read.
- `.env` is not read.
- Environment variables are not dumped.
- Authorization headers are not logged.
- Evidence stores only sanitized request and response metadata.

If a real Provider adapter needs secret material in a later phase, that must remain behind the existing CredentialRef resolver/provider adapter boundary. The executor must not touch raw values.
