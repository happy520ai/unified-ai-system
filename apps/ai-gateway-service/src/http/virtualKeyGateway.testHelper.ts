import { GatewayService } from "../core/gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { bindGatewayExecution } from "./httpRequestExecution.ts";
import { resolveVirtualKeyRequestAccounting } from "./openAiCompatibilityRoutes.js";

// Older protocol fixtures supplied Gateway envelopes directly. Use those same
// scripted results as a local Provider backend, so key tests traverse the real
// Gateway accounting boundary without copying accounting into the fixture.
export function bindVirtualKeyTestGateway(context: any): any {
  const gateway = context.gatewayService;
  if (!context.request?.enterpriseIdentity?.apiKeyFingerprint) return gateway;
  const execution = { signal: new AbortController().signal, deadlineAt: Date.now() + 30_000, timeoutMs: 30_000 };
  const bind = (service: object) => bindGatewayExecution(service, execution,
    () => context.request.enterpriseIdentity,
    () => resolveVirtualKeyRequestAccounting({ ...context, path: context.url?.pathname ?? "/fixture" }));
  if (gateway instanceof GatewayService) return bind(gateway);

  const descriptors = gateway.getProviderDescriptors?.() ?? [{ id: "fake", metadata: { providerType: "fake" },
    models: [{ id: "fake-model", enabled: true, capabilities: ["chat"] }] }];
  function throwFixtureFailure(result: any) {
    if (result?.success !== false) return;
    const details = result.error ?? { code: result.code, message: result.message };
    throw Object.assign(new Error(details.message ?? "Scripted provider failure."), details);
  }
  function coreFor(input: any) {
    const registry = new ProviderRegistry();
    for (const descriptor of descriptors) {
      registry.register({
        descriptor: { ...descriptor, metadata: { ...descriptor.metadata, providerType: "fake" } },
        async generate() {
          const result: any = await Reflect.apply(gateway.execute, gateway, [input]);
          throwFixtureFailure(result);
          const data = result.data ?? result;
          const text = data.message?.content ?? data.outputText ?? data.text ?? "";
          return { text, message: data.message ?? { role: "assistant", content: text }, usage: data.usage,
            raw: { ...data.rawProviderMeta, ...(data.finishReason ? { finishReason: data.finishReason } : {}) },
            executionStatus: data.executionStatus ?? "success", warnings: [], latencyMs: 0 };
        },
        async *generateStream() {
          const stream = Reflect.apply(gateway.executeStream, gateway, [input]) as AsyncIterable<any>;
          for await (const event of stream) {
            if (event.type === "error") throwFixtureFailure({ success: false, error: event.envelope?.error ?? event.error });
            if (event.type === "chunk") yield { textDelta: event.textDelta ?? "", raw: event.rawProviderMeta ?? {} };
            if (event.type === "done") yield { textDelta: "", usageOnly: true,
              raw: { ...event.rawProviderMeta, ...(event.finishReason ? { finishReason: event.finishReason } : {}) } };
          }
        },
      });
    }
    return bind(new GatewayService({ providerRegistry: registry,
      runtimeConfig: { providerMode: "fake", realProviderEnabled: false, fallbackEnabled: false } }));
  }
  return new Proxy(gateway, {
    get(target, property, receiver) {
      if (property === "execute" || property === "executeStream") {
        const method = Reflect.get(target, property, receiver);
        if (typeof method !== "function") return method;
        return new Proxy(method, { apply(_target, _receiver, [input]) {
          const core = coreFor(input) as GatewayService;
          return property === "execute" ? core.execute(input) : core.executeStream(input);
        } });
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
