import type {
  GatewayRequest,
  GatewayRouteResult,
  GatewayStreamEvent,
  ProviderDescriptor,
} from "@unified-ai-system/shared-contracts";

/**
 * GatewayService 的运行时配置（对应 createGatewayApplication 注入的 runtimeConfig）。
 */
export interface GatewayRuntimeConfig {
  providerMode: string;
  realProviderEnabled: boolean;
  fallbackEnabled?: boolean;
  costGuardEnforce?: boolean;
  modelAccessEnforce?: boolean;
}

/**
 * ProviderRegistry 的最小接口（GatewayService 只依赖 select / listDescriptors）。
 */
export interface GatewayProviderRegistry {
  select(request: GatewayRequest): unknown;
  listDescriptors(): ProviderDescriptor[];
}

/**
 * 可选的健康打分器（recordSuccess / recordFailure 用于健康加权选择）。
 */
export interface GatewayHealthScorer {
  recordSuccess(providerId: string, latencyMs: number): void;
  recordFailure(providerId: string, errorCode: string): void;
}

/**
 * 可选的台账记录器（log 单条调用：token/成本/延迟/provider/model）。
 */
export interface GatewayRequestLogger {
  log(entry: Record<string, unknown>): void;
}

/**
 * 可选的治理检查器（checkModelAccess 用于模型访问守卫）。
 */
export interface GatewayGovernance {
  checkModelAccess(userId: string, modelId: string): boolean;
}

export interface GatewayServiceOptions {
  providerRegistry: GatewayProviderRegistry;
  runtimeConfig?: Partial<GatewayRuntimeConfig>;
  healthScorer?: GatewayHealthScorer | null;
  requestLogger?: GatewayRequestLogger | null;
  governance?: GatewayGovernance | null;
}

/**
 * 网关核心服务：统一 chat/流式路由、provider 选择、fallback、成本守卫、模型访问守卫、台账。
 */
export interface GatewayService {
  execute(input: Partial<GatewayRequest>): Promise<GatewayRouteResult>;
  executeStream(input: Partial<GatewayRequest>): AsyncGenerator<GatewayStreamEvent>;
  getProviderDescriptors(): ProviderDescriptor[];
}
