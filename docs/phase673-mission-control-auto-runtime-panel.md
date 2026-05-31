# Phase673 Mission Control Auto Runtime Panel

Phase673 adds a read-only Mission Control panel for Taiji / Beidou Auto Runtime v0.

The panel displays:
- auto runtime v0 status
- admitted, executed, blocked, failed, and disabled counts
- provider/secret/deploy/chat/execute guards
- productionReady=false
- kill switch availability

Allowed preview actions are limited to viewing runtime evidence, blocked reason, rollback plan, and admission decision. No execution, Provider, secret, deploy, `/chat`, or `/chat-gateway/execute` buttons are added.
