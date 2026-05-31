# Yiyi Hunyuan3D Local Setup Preflight

## Result

- task: Yiyi-Local-Hunyuan3D-Setup-B
- enginePath: E:/AI-Data/AI-Engines/Hunyuan3D-2.1
- installAllowed: true
- generationAllowedOnThisMachine: false
- blocker: insufficient_vram_for_hunyuan3d_generation

## System

- platform: win32 10.0.19045 x64
- memory: 2.63 GB free / 15.94 GB total
- E drive free: 144.02 GB

## GPU

- NVIDIA GeForce GTX 1050 Ti: 4 GB, driver 576.88

## Python / Conda / Git

- python: Python 3.11.9
- py launcher: available
- conda: not available
- git: git version 2.53.0.windows.2

## Torch CUDA

```json
{"torchInstalled": true, "torchVersion": "2.11.0+cpu", "cudaAvailable": false, "cudaVersion": null, "deviceCount": 0}
```

## Hunyuan3D Requirement Boundary

- shape generation VRAM target: about 10 GB
- texture generation VRAM target: about 21 GB
- full pipeline VRAM target: about 29 GB

Current machine max VRAM: 4 GB.

## Safety

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- rawPhotoStored=false
- faceRecognitionPerformed=false
- workspaceCleanClaimed=false
