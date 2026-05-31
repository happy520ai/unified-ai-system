import { renderMainWorkspace } from "./MainWorkspace.js";
import { renderProgressiveDetailsDrawer } from "./ProgressiveDetailsDrawer.js";
import { renderResponsiveFrame } from "./ResponsiveFrame.js";
import { renderSystemTopBar } from "./SystemTopBar.js";
import { renderMinimalOsBackground } from "../MinimalOsBackground.js";

export function renderFutureMinimalShell({ copy, state, primaryModules, secondaryModules, detailModules, diagnosticsModules, previewCard, sampleBridge, styleTag }) {
  const shell = `
              ${styleTag}
              <section class="future-os-panel" id="future-minimal-os-panel" data-future-minimal-os-root="true" aria-labelledby="future-os-title">
${renderMinimalOsBackground()}
                <div class="future-os-content">
${renderSystemTopBar(copy)}
${renderMainWorkspace({ copy, state, primaryModules, secondaryModules, previewCard })}
${renderProgressiveDetailsDrawer({ copy, detailModules, diagnosticsModules })}
                  <section class="future-local-utility-strip" aria-label="Local self-use utility">
${sampleBridge}
                  </section>
                </div>
              </section>`;

  return renderResponsiveFrame(shell);
}
