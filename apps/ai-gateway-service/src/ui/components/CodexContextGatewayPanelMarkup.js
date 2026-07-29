import { renderCodexContextGatewayPanelMarkupA } from "./CodexContextGatewayPanelMarkupA.js";
import { renderCodexContextGatewayPanelMarkupB } from "./CodexContextGatewayPanelMarkupB.js";

export function renderCodexContextGatewayPanelMarkup(context) {
  return renderCodexContextGatewayPanelMarkupA(context) + renderCodexContextGatewayPanelMarkupB(context);
}
