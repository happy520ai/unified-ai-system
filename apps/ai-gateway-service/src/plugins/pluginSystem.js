// =============================================================================
// pluginSystem.js — 插件系统
// 插件注册、生命周期管理、钩子系统
// =============================================================================

import { randomUUID } from "node:crypto";

export function createPluginSystem(options = {}) {
  const plugins = new Map();
  const hooks = new Map(); // hookName -> [{ pluginId, handler, priority }]
  const MAX_PLUGINS = 100;

  function registerPlugin(plugin) {
    if (plugins.size >= MAX_PLUGINS) throw new Error("Max plugins reached");
    const id = plugin.id ?? randomUUID().slice(0, 8);
    const entry = {
      id,
      name: plugin.name ?? id,
      version: plugin.version ?? "1.0.0",
      description: plugin.description ?? "",
      author: plugin.author ?? "",
      hooks: plugin.hooks ?? {},
      config: plugin.config ?? {},
      enabled: true,
      registeredAt: Date.now(),
    };
    plugins.set(id, entry);

    // 注册钩子
    for (const [hookName, handler] of Object.entries(entry.hooks)) {
      if (!hooks.has(hookName)) hooks.set(hookName, []);
      hooks.get(hookName).push({ pluginId: id, handler, priority: plugin.priority ?? 50 });
      hooks.get(hookName).sort((a, b) => b.priority - a.priority);
    }

    return entry;
  }

  function unregisterPlugin(id) {
    const plugin = plugins.get(id);
    if (!plugin) return false;
    plugins.delete(id);

    // 清理钩子
    for (const [hookName, handlers] of hooks) {
      hooks.set(hookName, handlers.filter((h) => h.pluginId !== id));
    }
    return true;
  }

  function enablePlugin(id) {
    const p = plugins.get(id);
    if (p) p.enabled = true;
  }

  function disablePlugin(id) {
    const p = plugins.get(id);
    if (p) p.enabled = false;
  }

  async function executeHook(hookName, context = {}) {
    const handlers = hooks.get(hookName) ?? [];
    let result = context;

    for (const { pluginId, handler } of handlers) {
      const plugin = plugins.get(pluginId);
      if (!plugin?.enabled) continue;

      try {
        const hookResult = await handler(result);
        if (hookResult !== undefined) result = hookResult;
      } catch (err) {
        console.error(`[plugin:${pluginId}] Hook ${hookName} error:`, err.message);
      }
    }
    return result;
  }

  function hasHook(hookName) {
    return hooks.has(hookName) && hooks.get(hookName).some((h) => plugins.get(h.pluginId)?.enabled);
  }

  function listPlugins() {
    return Array.from(plugins.values());
  }

  function getPlugin(id) {
    return plugins.get(id) ?? null;
  }

  function getStats() {
    return {
      totalPlugins: plugins.size,
      enabledPlugins: Array.from(plugins.values()).filter((p) => p.enabled).length,
      totalHooks: hooks.size,
      hookNames: [...hooks.keys()],
    };
  }

  return { registerPlugin, unregisterPlugin, enablePlugin, disablePlugin, executeHook, hasHook, listPlugins, getPlugin, getStats };
}
