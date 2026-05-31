# Phase638R Nightly Runner Policy

nightlyStartTimeLocal=20:00
timezone=local machine timezone
runMode=one_shot_batch
daemon=false
infiniteLoop=false
maxTasksPerNightDefault=8
maxTasksPerNightHardLimit=12
allowedRiskTiers=["low","medium-safe"]
highRiskAutoExecute=false
highRiskGateOnly=true
stopOnFirstFailure=true
phase632PreflightRequired=true
tokenSavingTemplateRequired=true
providerCallsAllowed=false
secretAccessAllowed=false
deployAllowed=false
pushCommitAllowed=false

## Scope

The nightly runner is a local one-shot batch for safe engineering maintenance only. It may check docs, evidence, package scripts, managed block drift, Phase632 preflight health, and read-only Mission Control copy. It must not execute high-risk tasks.

## Boundary

The runner must not execute `codex exec`, call Providers, read auth.json, read or output secrets, write Codex config, modify `/chat`, modify `/chat-gateway/execute`, modify provider runtime, deploy, release, tag, push, commit, or claim workspace clean.
