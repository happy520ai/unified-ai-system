# Phase577 Position Library Official Import Plan

Phase577 defines the official import plan for O*NET, SOC, ISCO, and ESCO.

This phase does not download source datasets, does not perform full import, and does not claim complete world job coverage.

Import gates:
- Pin source version before import.
- Record sourceRef for every imported record.
- Keep license/source attribution with every record.
- Preserve source lineage during dedupe and alias merge.
- Block network import until a later explicit authorization phase.

Safety:
- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice

