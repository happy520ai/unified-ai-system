# Yiyi Real VRM Integration

## Goal

Connect Yiyi to a real VRM model at:

```text
apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm
```

CSS/SVG pseudo-3D must not be used as the primary Yiyi avatar and must not be described as real 3D.

## Current Result

`yiyi.vrm` is not present yet. The Workbench therefore shows:

```text
Yiyi real 3D model not connected yet
```

Runtime status remains:

- real3DModelLoaded=false
- pseudo3DLiveMotion=false
- providerCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- rawPhotoStored=false
- faceRecognitionPerformed=false

## Runtime Plan

When `yiyi.vrm` is added, the next implementation step can safely enable:

- `three`
- `@pixiv/three-vrm`
- VRM loader stage in `YiyiAvatarStage`

The recommended loader stack is:

```text
Three.js scene
GLTFLoader
@pixiv/three-vrm VRMLoaderPlugin / VRMUtils
idle breathing animation
state-driven orbit / guard / evidence overlays
```

## Visual Target

Yiyi should read as:

- 海风白帽
- 长黑发
- 珍珠白 / 浅蓝
- 温柔大眼
- 轻未来感
- Mission Companion

Not acceptable:

- snowman
- round blob
- toy-like blob
- CSS/SVG pseudo body claimed as real 3D

## Boundary

This integration does not call OpenAI, Claude, OpenRouter, MiMo, or any paid provider. It does not use external photo-to-3D services, does not store raw user photos, does not perform face recognition, and does not deploy.
