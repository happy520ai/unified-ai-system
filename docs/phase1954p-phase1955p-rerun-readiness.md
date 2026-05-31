# Phase1954P Phase1955P Rerun Readiness

Phase1954P prepares Phase1955P to rerun the guarded one-shot test with a real safe bridge in place.

Phase1955P still needs a fresh owner approval and must keep:

- max requests at `1`
- retry attempts at `0`
- CredentialRef-only input
- raw secret reads blocked
- `/chat` and `/chat-gateway/execute` unchanged

Phase1954P does not execute the real Provider call.
