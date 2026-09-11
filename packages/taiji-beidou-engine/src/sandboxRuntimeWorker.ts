import { parentPort, workerData } from "node:worker_threads";
import { digest, executeProfile, normalizeProfileArguments, normalizeProfileParameters, runtimeProfileHash } from "./sandboxRuntimeProfiles.ts";

// Fixed trusted code, with no request-supplied imports, functions or source.
const profileId = workerData.profileId;
const args = normalizeProfileArguments(profileId, workerData.arguments);
const parameters = normalizeProfileParameters(profileId, workerData.parameters);
const artifact = executeProfile(profileId, args, parameters);
parentPort?.postMessage({ implementationHash: runtimeProfileHash(profileId), parametersHash: digest(JSON.stringify(parameters)), artifact });
parentPort?.close();
