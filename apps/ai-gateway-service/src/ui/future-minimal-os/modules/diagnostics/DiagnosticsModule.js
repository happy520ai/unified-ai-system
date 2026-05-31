import { renderModuleCard } from "../../components/ModuleCard.js";

export function renderDiagnosticsModule({ copy }) {
  return renderModuleCard({
    title: copy.drawerCopy.groups.diagnostics.title,
    body: copy.drawerCopy.groups.diagnostics.body,
    meta: "hidden until details open",
    collapsed: true,
    id: "future-diagnostics-module"
  });
}
