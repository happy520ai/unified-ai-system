import { createRuntimeEmployeeSelector } from "@unified-ai-system/workforce-scheduler";
import type { WorkforceSelectionTask } from "@unified-ai-system/shared-contracts";
import { createWorkforceRoleProviderFactory, type WorkforceRoleRunContext } from "./workforceRoleProvider.ts";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { listWorkforceRoles } from "./workforceRoles.js";
import { getWorkforceRoleDependencies } from "./workforceRoleGraph.ts";
import { inheritVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";

/** A frozen server catalog; each resolved factory creates isolated per-run state. */
export function createWorkforceRoleSelection(options: Omit<Parameters<typeof createWorkforceRoleProviderFactory>[0], "profile"> & {
  configuration: unknown; now?: () => number;
}) {
  const selector = createRuntimeEmployeeSelector(options.configuration);
  const { gatewayService, providerRegistry } = options;
  const now = options.now ?? Date.now;
  const knownRoles = new Set(listWorkforceRoles().map((role: { roleId: string }) => role.roleId));
  return Object.freeze({ catalogHash: selector.catalogHash, resolve(input: WorkforceSelectionTask) {
    if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.getOwnPropertySymbols(input).length
      || Object.keys(input).sort().join("\0") !== ["executionMode", "roleIds", "taskType"].join("\0")
      || Object.values(Object.getOwnPropertyDescriptors(input)).some((property) => !("value" in property))
      || !denseRoleIds(input.roleIds)
      || new Set(input.roleIds).size !== input.roleIds.length) throw rejected("WORKFORCE_SELECTION_TASK_INVALID");
    const roles = new Set<string>();
    const include = (roleId: string) => {
      if (!knownRoles.has(roleId)) throw rejected("WORKFORCE_SELECTION_ROLE_UNSUPPORTED");
      if (roles.has(roleId)) return;
      for (const dependency of getWorkforceRoleDependencies(roleId)) include(dependency);
      roles.add(roleId);
    };
    input.roleIds.forEach(include);
    const decision = selector.select({ taskType: input.taskType, roleIds: [...roles], executionMode: input.executionMode });
    const profile = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required",
      profileId: `selection-${decision.selectionHash.slice(7)}`, maxTotalRequests: decision.maxTotalRequests,
      maxConcurrentRoles: decision.maxConcurrentRoles, bindings: decision.assignments.map((item) => item.binding) });
    const expiresAt = Math.min(...decision.assignments.map((item) => Date.parse(item.qualification.validUntil)));
    const assertExpiry = () => {
      const time = now();
      if (!Number.isFinite(time) || time >= expiresAt) throw rejected("WORKFORCE_SELECTION_QUALIFICATION_EXPIRED");
    };
    assertExpiry();
    const assertTargets = () => {
      assertExpiry();
      for (const { binding } of decision.assignments) {
        const descriptor = (providerRegistry.get(binding.providerId) as any)?.descriptor;
        if (!descriptor || descriptor.enabled === false || !Array.isArray(descriptor.models)
          || !descriptor.models.some((model: any) => model.id === binding.modelId && model.enabled === true)) throw rejected("WORKFORCE_SELECTION_TARGET_UNAVAILABLE");
        if ((descriptor.metadata?.providerType === "fake") !== (decision.executionMode === "fake")) throw rejected("WORKFORCE_SELECTION_EXECUTION_MODE_MISMATCH");
      }
    };
    const factory = createWorkforceRoleProviderFactory({ gatewayService, providerRegistry, profile, assertDispatch: assertTargets });
    const roleProviderFactory = Object.freeze({ profile, forRun(context: WorkforceRoleRunContext) {
      assertTargets();
      const fence = context?.agentFence;
      if (typeof fence?.assertActive !== "function") throw rejected("WORKFORCE_SELECTION_RUN_INVALID");
      const assertActive = fence.assertActive.bind(fence);
      const requestExecution = { ...context.requestExecution, deadlineAt: Math.min(context.requestExecution.deadlineAt, expiresAt) };
      inheritVirtualKeyRequestAccounting(context.requestExecution, requestExecution);
      const run = factory.forRun({ ...context, requestExecution,
        agentFence: { signal: fence.signal, async assertActive(phase) { await assertActive(phase); assertTargets(); } },
      });
      return Object.freeze({ ...run, createRoleAdapter(role: Parameters<typeof run.createRoleAdapter>[0]) {
        const taskFence = role?.taskFence;
        if (typeof taskFence?.assertActive !== "function") throw rejected("WORKFORCE_SELECTION_RUN_INVALID");
        const assertTaskActive = taskFence.assertActive.bind(taskFence);
        return run.createRoleAdapter({ ...role, taskFence: { signal: taskFence.signal,
          async assertActive(phase) { await assertTaskActive(phase); assertTargets(); },
        } });
      } });
    } });
    return Object.freeze({ decision, profile, roleProviderFactory, assertCurrentQualification: assertExpiry });
  } });
}

/** Explicit production opt-in. Immutable decisions are reused across review/approval/execute. */
export function createConfiguredWorkforceRoleSelection(options: Omit<Parameters<typeof createWorkforceRoleSelection>[0], "configuration"> & { configuration: unknown }) {
  const value = options.configuration;
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== 3 || Object.keys(value).sort().join("\0") !== ["catalog", "executionMode", "version"].join("\0")
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(property => !("value" in property))) throw rejected("WORKFORCE_SELECTION_CONFIG_INVALID");
  const source = value as { version: unknown; executionMode: unknown; catalog: unknown };
  if (source.version !== 1 || (source.executionMode !== "fake" && source.executionMode !== "real")) throw rejected("WORKFORCE_SELECTION_CONFIG_INVALID");
  const executionMode = source.executionMode;
  const selector = createWorkforceRoleSelection({ ...options, configuration: source.catalog });
  const contexts = new Map<string, ReturnType<typeof selector.resolve>>();
  return Object.freeze({ catalogHash: selector.catalogHash, executionMode,
    resolve(task: Omit<WorkforceSelectionTask, "executionMode">) {
      if (typeof task?.taskType !== "string" || !denseRoleIds(task.roleIds)) throw rejected("WORKFORCE_SELECTION_TASK_INVALID");
      const key = JSON.stringify([task.taskType, [...task.roleIds].sort()]);
      const stored = contexts.get(key);
      if (stored) { stored.assertCurrentQualification(); return stored; }
      if (contexts.size >= 128) throw rejected("WORKFORCE_SELECTION_CAPACITY");
      const selected = selector.resolve({ taskType: task.taskType, roleIds: task.roleIds, executionMode });
      contexts.set(key, selected);
      return selected;
    },
  });
}

function denseRoleIds(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length
    || value.length < 1 || value.length > 7 || Object.getOwnPropertyNames(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const property = Object.getOwnPropertyDescriptor(value, String(index)); if (!property || !("value" in property) || typeof property.value !== "string") return false;
  }
  return true;
}

function rejected(code: string) {
  return Object.assign(new Error(`The selected Workforce assignment cannot execute: ${code}.`), { code, retryable: false });
}
