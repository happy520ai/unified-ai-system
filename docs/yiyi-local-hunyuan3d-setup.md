# Yiyi Local Hunyuan3D Setup

## Purpose

This document records the local Hunyuan3D-2.1 sidecar setup route for Yiyi candidate model generation.

Workbench must not generate 3D characters at runtime. Workbench only loads an accepted `yiyi.vrm`, `yiyi.glb`, or `yiyi.gltf` after local generation, review, and promotion.

## Local Engine

- Engine: `Hunyuan3D-2.1`
- Role: primary local 3D candidate generation engine
- Source: `https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1`
- Local source directory: `.tool-external/hunyuan3d-2.1`
- Runtime mode: local sidecar/tooling only

## Current Machine Preflight

The official Hunyuan3D-2.1 instructions state the tested environment is Python 3.10 with PyTorch 2.5.1 + CUDA 12.4. The public README also lists approximate VRAM requirements:

- Shape generation: about 10 GB VRAM
- Texture generation: about 21 GB VRAM
- Shape + texture generation: about 29 GB VRAM

This means a low-VRAM GPU can still host the repository and setup scripts, but real generation must be blocked until hardware and model weights are ready.

## Commands

Source setup:

```powershell
node tools/yiyi/setup-hunyuan3d-local.mjs --clone
```

Preflight:

```powershell
node tools/yiyi/preflight-hunyuan3d-local.mjs
```

Smoke:

```powershell
node tools/yiyi/smoke-hunyuan3d-local.mjs
```

Pipeline dry-run:

```powershell
$env:YIYI_3D_ENGINE="hunyuan3d"
$env:YIYI_3D_ENGINE_PATH=".tool-external/hunyuan3d-2.1"
$env:YIYI_3D_DRY_RUN="true"
node tools/yiyi/generate-yiyi-3d-candidate.mjs --dry-run
```

## Block Rules

Do not run real candidate generation when:

- Hunyuan3D source is missing.
- Model weights are missing.
- GPU VRAM is below shape-generation requirements.
- The reference image is a raw user photo.
- Any cloud provider or photo-to-3D service would be required.
- Any secret value would be read, printed, or stored.

## Safety Boundary

This setup does not:

- modify Workbench UI
- call OpenAI, Claude, OpenRouter, MiMo, or non-NVIDIA providers
- call cloud photo-to-3D
- upload images
- store raw user photos
- perform face recognition
- infer sensitive attributes
- deploy, release, tag, or upload artifacts
- claim `real3DModelLoaded=true`
- claim workspace clean
