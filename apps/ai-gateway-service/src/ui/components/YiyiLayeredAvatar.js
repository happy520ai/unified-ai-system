import { yiyiAvatarAssetManifest } from "../yiyi/avatar/yiyiAvatarAssetManifest.js";

function layer(name, src, extraClass = "") {
  return `<img class="yiyi-layered-part yiyi-layered-${name} ${extraClass}" data-yiyi-asset-layer="${name}" src="${src}" alt="" loading="eager" draggable="false">`;
}

export function renderYiyiLayeredAvatar() {
  const manifest = yiyiAvatarAssetManifest;
  return `
    <div class="yiyi-layered-avatar state-idle slimmer-silhouette"
      id="yiyi-layered-avatar"
      data-yiyi-layered-avatar="true"
      data-current-avatar-mode="${manifest.currentAvatarMode}"
      data-real-3d-model-loaded="${String(manifest.real3DModelLoaded)}"
      data-pseudo-3d-live-motion="${String(manifest.pseudo3DLiveMotion)}"
      data-layered-avatar-enabled="${String(manifest.layeredAvatarEnabled)}"
      data-future-model-format="${manifest.futureModelFormat}"
      data-future-loader="${manifest.futureLoader}">
      ${layer("aura", manifest.assets.aura)}
      ${layer("orbit-dots", manifest.assets.orbitDots)}
      ${layer("path-glow", manifest.assets.pathGlow)}
      ${layer("note-board", manifest.assets.noteBoard)}
      ${layer("hair-back", manifest.assets.hairBack)}
      ${layer("body", manifest.assets.body)}
      ${layer("arms", manifest.assets.arms)}
      ${layer("face", manifest.assets.face)}
      ${layer("hair-left", manifest.assets.hairLeft)}
      ${layer("hair-right", manifest.assets.hairRight)}
      ${layer("hat", manifest.assets.hat)}
      ${layer("shield", manifest.assets.shield)}
    </div>`;
}


