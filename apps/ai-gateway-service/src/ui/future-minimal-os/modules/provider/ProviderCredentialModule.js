import { renderModuleCard } from "../../components/ModuleCard.js";

export function renderProviderCredentialModule({ copy }) {
  return renderModuleCard({
    title: copy.drawerCopy.groups.provider.title,
    body: copy.drawerCopy.groups.provider.body,
    meta: "advanced-info / preview-only",
    collapsed: true,
    id: "future-provider-credential-module"
  });
}
