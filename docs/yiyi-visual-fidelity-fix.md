# Yiyi Visual Fidelity Fix

## Goal

This UI-only fix replaces the snowman-like live avatar silhouette with a pseudo-3D Yiyi figure aligned to the existing sea-breeze white-hat concept direction.

## What Changed

- Split the live avatar into explicit visual parts: long black hair, hat brim, hat crown, face, eyes, neck, shoulders, jacket, collar, tech lines, cape, hands, shield, orbit, route, and note markers.
- Replaced the old round body-core shape with a lighter jacket and shoulder silhouette.
- Added visible long black hair and hair tails so the avatar no longer reads as a white snow blob.
- Reworked the hat into a white/straw-style soft hat with brim, crown, ribbon, and subtle texture instead of a glowing halo.
- Preserved the existing live motion and state reactions for mouse attention, guard, blocked, god, tianshu, and evidence states.

## Safety Boundary

- real3DModelLoaded=false
- pseudo3DLiveMotion=true
- gltfIntegrationReserved=true
- providerCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- workspaceCleanClaimed=false

## Evidence

- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/yiyi-visual-fidelity-result.json`
- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots/yiyi-visual-overview.png`
- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots/yiyi-hair-hat-detail.png`
- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots/yiyi-body-jacket-detail.png`
- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots/yiyi-guard-visual.png`
- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots/yiyi-god-visual.png`
- `apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots/yiyi-tianshu-visual.png`

## Remaining Limits

This remains a DOM/CSS/SVG-style pseudo-3D live avatar. A true glTF/GLB character model, rigged animation clips, designer redraw, mobile-specific art tuning, and performance profiling remain future work.
