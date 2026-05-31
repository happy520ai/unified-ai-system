# Yiyi Local 3D Generation Engine Pipeline

## Purpose

This pipeline defines how Yiyi candidate 3D assets are generated outside the Workbench and then reviewed before they are allowed to become the Workbench avatar.

Workbench does not generate a character model at runtime. Workbench only loads an accepted `yiyi.vrm`, `yiyi.glb`, or `yiyi.gltf` from the local asset directory.

## Why CSS/SVG Is No Longer The Primary Avatar

The earlier CSS/SVG and layered 2.5D approaches were useful as UI placeholders, but they are not stable enough for the final character identity. They can drift into snowman, blob, toy, or back-view silhouettes.

The primary Yiyi avatar path is now real 3D asset first:

1. Generate a local candidate model.
2. Review it against the Yiyi character acceptance checklist.
3. Post-process it in Blender or a VRM workflow.
4. Place only accepted assets under `apps/ai-gateway-service/src/ui/assets/yiyi/model/`.
5. Let Workbench load the accepted model.

CSS/SVG assets may remain as reference or fallback UI only. They must not be described as real 3D or production avatar assets.

## Local Engine Route

Preferred engines:

- `Hunyuan3D-2.1`: primary local text/image-to-3D candidate generation route.
- `CharacterGen`: character-focused route for turning approved concept references into a character mesh.
- `InstantMesh`: quick single-image mesh fallback when the primary engine is unavailable.
- `Blender + VRM Add-on`: repair topology, materials, proportions, bones, and VRM metadata.
- `glTF Transform / glTF Validator`: optimize and validate GLB/GLTF output before Workbench loading.

The local adapter is:

```powershell
node tools/yiyi/generate-yiyi-3d-candidate.mjs --dry-run
```

Supported environment variables:

- `YIYI_3D_ENGINE=hunyuan3d | charactergen | instantmesh | none`
- `YIYI_3D_ENGINE_PATH=<local engine path>`
- `YIYI_3D_DRY_RUN=true`
- `YIYI_3D_REFERENCE_IMAGE=<local approved concept image path>`
- `YIYI_3D_OUTPUT_DIR=apps/ai-gateway-service/src/ui/assets/yiyi/generated`

This adapter does not call cloud APIs, upload images, read secrets, or forge model output. In this phase it only validates local configuration and writes a command preview.

## Asset Directories

- Generation config: `apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi-3d-generation-config.json`
- Candidate output: `apps/ai-gateway-service/src/ui/assets/yiyi/generated/`
- Accepted runtime model: `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm`
- GLB fallback: `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.glb`
- Manifest: `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json`

## Character Target

Yiyi should read as:

- 海风白帽
- 长黑发
- 珍珠白浅蓝服装
- 温柔大眼
- 纤细比例
- 轻未来感 Mission Companion

Negative style:

- snowman
- blob
- chubby doll
- round mascot
- faceless toy

## GLB To VRM Route

1. Generate `yiyi_candidate.glb` or `yiyi_candidate.obj` locally.
2. Inspect silhouette, hair, hat, face, clothing, and proportions.
3. Repair mesh, materials, and scale in Blender.
4. Add or repair skeleton and humanoid mapping.
5. Export `yiyi.vrm` when VRM metadata and runtime loading requirements are satisfied.
6. Validate the final file before updating manifest fields to runtime-loaded status.

## Workbench Boundary

Workbench loads only accepted assets:

- `yiyi.vrm`
- `yiyi.glb`
- `yiyi.gltf`

If no accepted model exists, Workbench must show the safe placeholder:

`Yiyi real 3D model not connected yet`

Workbench must not show the CSS/SVG snowman-style avatar as the primary Yiyi character.

## Safety Boundary

This pipeline does not:

- upload user photos
- store raw user photos
- perform face recognition
- infer sensitive attributes
- call OpenAI, Claude, OpenRouter, MiMo, or non-NVIDIA providers
- call any cloud photo-to-3D service
- read or print secrets
- deploy or release
- claim `real3DModelLoaded=true` without a real accepted model asset

Current safety posture:

- `providerCallsMade=false`
- `nonNvidiaProviderCallsMade=false`
- `secretValueExposed=false`
- `rawPhotoStored=false`
- `faceRecognitionPerformed=false`
- `deployExecuted=false`

## Validation

Required commands:

```powershell
node --check tools/yiyi/generate-yiyi-3d-candidate.mjs
node --check tools/yiyi/validate-yiyi-3d-candidate.mjs
node tools/yiyi/generate-yiyi-3d-candidate.mjs --dry-run
node tools/yiyi/validate-yiyi-3d-candidate.mjs
```

The candidate validator checks the generated directory, candidate extensions, safety flags, manifest claims, and whether any concept board or CSS/SVG fallback has been promoted to production 3D.
