# Phase1941-1950 Safety Boundary

Forbidden in this phase:
- exec/eval/new Function/vm.runIn*
- User uploaded code execution
- P2P, npm, or PyPI package scan/pull
- Provider calls
- raw secret, auth.json, or .env reads
- Authorization header or raw key output
- `/chat` or `/chat-gateway/execute` default route changes
- deploy, release, tag, artifact upload

The risk gate blocks Provider, secret, deploy/release/tag/artifact, unapproved write_file, dynamic code, network fetch, and chat-gateway modification signals.
