import { evidenceModuleDescriptor } from "../modules/evidence/evidenceModuleDescriptor.js";
import { diagnosticsModuleDescriptor } from "../modules/diagnostics/diagnosticsModuleDescriptor.js";
import { missionModuleDescriptor } from "../modules/mission/missionModuleDescriptor.js";
import { modeModuleDescriptor } from "../modules/modes/modeModuleDescriptor.js";
import { providerModuleDescriptor } from "../modules/provider/providerModuleDescriptor.js";
import { securityModuleDescriptor } from "../modules/security/securityModuleDescriptor.js";

export const futureMinimalModuleRegistry = [
  missionModuleDescriptor,
  modeModuleDescriptor,
  securityModuleDescriptor,
  providerModuleDescriptor,
  evidenceModuleDescriptor,
  diagnosticsModuleDescriptor
].sort((left, right) => left.priority - right.priority);

export function getFutureMinimalModulesForZone(zone) {
  return futureMinimalModuleRegistry
    .filter((descriptor) => descriptor.zone === zone)
    .sort((left, right) => left.priority - right.priority);
}
