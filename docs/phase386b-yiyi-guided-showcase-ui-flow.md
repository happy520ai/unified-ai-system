# Phase386B Yiyi Guided Showcase UI Flow

Guided Showcase is embedded in Mission Control as a local demo flow.

UI flow:
- Start Guided Showcase / 进入依依演示 starts the local stepper.
- Ten steps cover welcome, overview, Normal, God, Tianshu, Security Shield, Red Team, Evidence Replay, Yiyi Brain status, and closing summary.
- Back / Next / Skip are local UI controls only.
- Demo Safety Bar keeps dry-run, model brain disabled, no provider call, no secret, no deploy, and evidence recorded visible.

Boundary:
- No provider runtime is called.
- No chat send route is changed.
- No deploy, release, billing, invoice, artifact, or tag action is exposed.
