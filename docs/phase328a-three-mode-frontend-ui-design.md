# Phase328A Three Mode Frontend UI Design

## Page

Workbench quick chat page embeds a Three Mode runtime panel below the existing chat composer.

## UI sections

- mode tabs: normal / god / tianshu
- mode-specific input panels
- runtime safety badge
- result panel
- audit trace panel

## Normal Mode UI

- selectable model dropdown
- task input
- send button
- provider status

## God Mode UI

- participant multi-select
- supervisor model select
- auto-select toggle
- max participant control
- task input
- send button

## Tianshu Mode UI

- task input
- task type preview
- allow God escalation toggle
- send button

## Guardrails

- existing quick chat send path remains visible and usable
- new UI calls `/three-mode/execute`
- no secret field is exposed
- audit trace and provider call status are visible
- non-NVIDIA runtime is not presented as enabled
