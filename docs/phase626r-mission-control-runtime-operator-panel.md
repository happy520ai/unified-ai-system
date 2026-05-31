# Phase626R Mission Control Runtime Operator Panel

Mission Control may show read-only runtime candidate status.

Visible fields:
- isolated runtime candidate status
- Phase624 one-shot result if evidence exists
- Phase625 repeated reliability result if evidence exists
- maxRequests policy
- rollback ready
- emergency disable ready
- not default `/chat` integrated
- not `/chat-gateway/execute` integrated
- not production ready
- next manual approval required

Forbidden UI:
- no "connect /chat" button
- no production execution button
- no deploy/release/push button
- no secret/auth.json input
