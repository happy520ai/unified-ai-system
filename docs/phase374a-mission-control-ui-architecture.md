# Phase374A Mission Control UI Architecture

Agent-managed Mission Control UI Layer:

User Intent -> UI Intent Router -> Agent-managed Panel Registry -> Security Shield / Governance Gate -> Fixed UI Components -> Evidence / Trace / Dry-run Result

Layout: Top System Radar, Left Minimal Navigation, Center Mission Workspace, Right Security Shield Panel, Bottom Evidence Timeline.

Boundaries: no dangerous buttons, no direct production control, no real provider call trigger, no secret display, no fake approval, no fake production status.
