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
  enabledProviders?: string[];
  fallbackEnabled?: boolean;
  costGuardEnforce?: boolean;
  modelAccessEnforce?: boolean;
  shadowRealProviderEnabled?: boolean;
  shadowTimeoutMs?: number;
  requireDurableUsageLedger?: boolean;
  requireProviderDispatchGate?: boolean;
}

/**
 * ProviderRegistry 的最小接口（GatewayService 只依赖 select / listDescriptors）。
 */
export interface GatewayProviderRegistry {
  select(request: GatewayRequest): unknown;
  listDescriptors(): readonly unknown[] | null;
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
  log(entry: Record<string, unknown>): void | Promise<void>;
  assertDurable?(): boolean | Promise<boolean>;
}

export interface GatewayEnterpriseAudit {
  recordAudit(entry: Record<string, unknown>): Promise<unknown>;
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
  enterpriseAudit?: GatewayEnterpriseAudit | null;
  providerDispatchGate?: {
    reserve(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  } | null;
  governance?: GatewayGovernance | null;
}

export interface GatewayProviderOperationInput {
  operationType: string;
  providerId: string;
  providerType?: string;
  modelId: string;
  path: string;
  requestFingerprint: string;
  invoke: () => Promise<unknown>;
  enterpriseIdentity?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/** Internal, non-JSON capability marker for a verified provider dispatch binding. */
export declare const MANAGED_LOCAL_CLIENT_PROVIDER_PIN: unique symbol;

export interface GatewayManagedLocalClientProviderBinding {
  readonly clientId: string;
  assertAttempt(input: { providerId: string; modelId: string }): unknown;
}

export type GatewayExecutionInput = Partial<GatewayRequest> & {
  readonly [MANAGED_LOCAL_CLIENT_PROVIDER_PIN]?: GatewayManagedLocalClientProviderBinding;
  readonly enterpriseIdentity?: Record<string, unknown>;
};

/**
 * 网关核心服务：统一 chat/流式路由、provider 选择、fallback、成本守卫、模型访问守卫、台账。
 */
export declare class GatewayService {
  constructor(options: GatewayServiceOptions & Record<string, unknown>);
  readonly runtimeConfig: Partial<GatewayRuntimeConfig>;
  execute(input: GatewayExecutionInput, execution?: { signal?: AbortSignal; shadow?: boolean; providerDispatchKeyHash?: string; providerDispatchKeyInvalid?: boolean; providerDispatchRoute?: string; providerDispatchInvocation?: number }): Promise<GatewayRouteResult>;
  executeStream(input: GatewayExecutionInput, execution?: { signal?: AbortSignal; shadow?: boolean; providerDispatchKeyHash?: string; providerDispatchKeyInvalid?: boolean; providerDispatchRoute?: string; providerDispatchInvocation?: number }): AsyncGenerator<GatewayStreamEvent>;
  executeProviderOperation(input: GatewayProviderOperationInput, execution?: { signal?: AbortSignal; providerDispatchKeyHash?: string; providerDispatchKeyInvalid?: boolean; providerDispatchRoute?: string; providerDispatchInvocation?: number; transportRequestId?: string; transportTraceId?: string }): Promise<unknown>;
  getProviderDescriptors(): ProviderDescriptor[];
}

export declare function createRouteFailureEnvelope(error: unknown, context?: Record<string, unknown>): GatewayRouteResult;
