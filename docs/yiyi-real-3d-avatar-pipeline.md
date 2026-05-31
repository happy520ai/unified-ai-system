# Yiyi Real 3D Avatar Pipeline

## Goal

Yiyi should move toward a real 3D avatar asset pipeline. CSS/SVG pseudo-3D and layered 2.5D assets are fallback-only and must not be described as a production 3D model.

## Recommended Asset Route

- Preferred format: VRM.
- Backup formats: GLB / GLTF.
- Recommended tools: VRoid Studio, Blender, VRM Add-on for Blender, glTF Validator, and glTF Transform.
- Recommended runtime path:
  - VRM: `@pixiv/three-vrm`
  - GLB / GLTF: `three` + `GLTFLoader`

## Current Status

- Real model asset expected at:
  - `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm`
  - `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.glb`
  - `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.gltf`
- Current manifest:
  - `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json`
- If no real model is present, UI shows: `Yiyi real 3D asset not connected yet`.
- Current fallback does not store raw photos and does not call photo-to-3D external services.

## Visual Target

Yiyi visual direction: 海风白帽 / 长黑发 / 珍珠白浅蓝 / 温柔未来感 Mission Companion.

## Safety Boundary

- No provider call.
- No OpenAI / Claude / OpenRouter / MiMo / non-NVIDIA provider call.
- No raw user photo storage.
- No face recognition.
- No sensitive attribute inference.
- No secret reading or printing.
- No deploy, release, tag, or artifact upload.

## Dependency Recommendation

Do not install new runtime dependencies until a real `yiyi.vrm`, `yiyi.glb`, or `yiyi.gltf` asset is ready to test.

When a real asset is available, add the smallest viable loader path:

```text
three + GLTFLoader for GLB / GLTF
@pixiv/three-vrm for VRM
```

That follow-up must include browser rendering smoke, asset size budget, animation fallback, and secret/provider/deploy safety checks.
