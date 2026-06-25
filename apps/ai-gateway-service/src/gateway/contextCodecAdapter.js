import { runContextCodecDryRun } from "@unified-ai-system/context-codec-core";
import { buildContextCodecRequest } from "./contextCodecRequestBuilder.js";

export function runContextCodecAdapter(input = {}, options = {}) {
  const request = buildContextCodecRequest(input);
  const result = runContextCodecDryRun(request, {
    format: options.format ?? "yaml_state",
  });
  return {
    ...result,
    requestId: request.requestId,
    mode: request.mode,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretRead: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
  };
}
