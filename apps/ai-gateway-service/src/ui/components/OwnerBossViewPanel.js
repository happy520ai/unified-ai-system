import { ownerBossViewCopy } from "../copy/ownerBossViewCopy.js";
import { ownerAutomationCommandPaletteCopy } from "../copy/ownerAutomationCommandCopy.js";
import { ownerAutomationFileActionResultCopy } from "../copy/ownerAutomationCopy.js";
import { renderOwnerOSShell } from "./OwnerOSShell.js";

export function renderOwnerBossViewPanel() {
  return renderOwnerOSShell({
    ...ownerBossViewCopy,
    ownerAutomationFileActionResult: ownerAutomationFileActionResultCopy,
    ownerAutomationCommandPalette: ownerAutomationCommandPaletteCopy,
  });
}


