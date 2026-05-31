# Phase587 Internal Employee Communication Bus

Phase587 adds an internal dry-run communication bus for Employee Library
employees. It is not an external IM connector phase.

## Scope

- Internal employee message envelopes.
- Employee threads, rooms, inbox, and outbox.
- Mentions, handoffs, review requests, objections, summaries, and final
  recommendations.
- Dry-run evidence timelines.
- Mission Control internal communication preview.

## Boundary

- No Feishu connector is required or used.
- No WeCom connector is required or used.
- No real external message is sent.
- No Provider is called.
- No secret is read or exposed.
- `/chat` and `/chat-gateway/execute` are not modified.
- Workforce Scheduler remains responsible for fanout and participant expansion.

