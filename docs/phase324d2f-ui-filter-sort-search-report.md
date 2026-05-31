# Phase324D-2F UI Filter Sort Search Report

## Scope

- Added local model-library search, filter, sort, and strategy display controls
  in the Workbench model configuration page.
- Did not modify Chat request body, selectable gate, real default routing,
  provider enablement, or verification metadata.

## Added UI Controls

- Search input:
  - modelId
  - providerId
  - evidenceId
  - capability
  - failureReason / nonSelectableReason
- Status filter:
  - all
  - selectable
  - smoke_passed
  - failed
  - unverified
  - high_latency
- Provider scope filter:
  - all
  - nvidia-enabled
  - future-provider-slot
- Capability filter:
  - all
  - chat_like
  - unknown
  - non_chat
- Sort:
  - default
  - modelId asc
  - status
  - latency asc
  - latency desc
  - selectable first
  - evidence present first
  - lastVerifiedAt

## Display Additions

- Filter result stats
- Empty-result message without API calls
- High latency warning badge
- Strategy summary banner
- Strategy cards:
  - defaultRecommended
  - fastModels
  - highQualityModels
  - lowLatencyModels
  - fallbackCandidates
  - highLatencyWarning

## Safety

- API called by filter/sort/search controls: false
- Selectable gate modified: false
- Chat dropdown source changed: false
- Real default model changed: false
- Multi-provider enabled: false
