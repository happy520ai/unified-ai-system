import { renderModuleCard } from "../../components/ModuleCard.js";

export function renderEvidenceReplayModule({ copy }) {
  return renderModuleCard({
    title: copy.drawerCopy.groups.evidence.title,
    body: copy.drawerCopy.groups.evidence.body,
    meta: "advanced-info / preview-only",
    collapsed: true,
    id: "future-evidence-replay-module"
  });
}
