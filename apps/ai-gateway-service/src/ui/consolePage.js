import { renderProviderCredentialRefPanel } from "./components/ProviderCredentialRefPanel.js";
import { providerCredentialCopy } from "./copy/providerCredentialCopy.js";
import {
  createPhase321AWorkbenchPage,
  stripCharacterUiForMissionControl,
} from "./consolePageTemplate.js";

export function createConsolePage() {
  return stripCharacterUiForMissionControl(createPhase321AWorkbenchPage());
}
