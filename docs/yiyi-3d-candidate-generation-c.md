# Yiyi 3D Candidate Generation C

## Purpose

This step generates a local candidate GLB for Yiyi:

`apps/ai-gateway-service/src/ui/assets/yiyi/generated/yiyi_candidate.glb`

The candidate is not a final runtime avatar. This phase does not generate `yiyi.vrm`, does not enable Workbench real 3D loading, and does not change the Chat or provider runtime.

## Required Input

Prepare a local PNG reference image at:

`apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi_reference.png`

The image must be an approved local Yiyi reference. Do not use raw user photos. Do not upload the image to cloud services. Do not run face recognition.

## Hunyuan3D API

Expected local sidecar:

- engine path: `E:/AI-Data/AI-Engines/Hunyuan3D-2.1`
- health endpoint: `http://127.0.0.1:8081/health`
- generation endpoint: `http://127.0.0.1:8081/generate`

The generation script can attempt to start `python api_server.py` from the Hunyuan3D directory, then wait for `/health`.

## Shape-Only First

Default generation uses `texture=false`.

Shape-only is the first safe route because texture generation has a higher VRAM requirement and a larger failure surface on Windows. Texture can be enabled later with `--texture` only after shape generation succeeds and the hardware/runtime preflight supports it.

## Commands

Dry-run:

```powershell
node tools/yiyi/run-yiyi-hunyuan3d-generate.mjs --dry-run
```

Real candidate generation:

```powershell
node tools/yiyi/run-yiyi-hunyuan3d-generate.mjs
```

Validation:

```powershell
node tools/yiyi/validate-yiyi-3d-candidate-generated.mjs
```

## Next Step

If `yiyi_candidate.glb` exists and passes validation, the next route is GLB acceptance review, then GLB-to-VRM conversion. Only after that should Workbench runtime loading be considered.

## Safety

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- rawPhotoStored=false
- faceRecognitionPerformed=false
- real3DModelLoaded=false
- realVrmRuntimeLoaded=false
