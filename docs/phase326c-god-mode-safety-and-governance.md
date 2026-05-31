# Phase326C God Mode Safety And Governance

## Rules

- do not call unauthorized providers
- do not use unconfigured API keys
- do not expose secrets
- do not bypass Model Library
- do not bypass provider governance
- do not bypass user mode policy
- do not allow failed or high-risk models to participate
- do not treat `shadow_config` as runtime
- do not enable high-cost multi-model calls by default

## Risk Notes

- cost amplification
- latency amplification
- models can reinforce each other's mistakes
- majority error is not truth
- Supervisor must preserve uncertainty when conflict remains
- users should be able to inspect participants and lightweight audit traces

