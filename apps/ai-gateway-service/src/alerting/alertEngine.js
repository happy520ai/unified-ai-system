// =============================================================================
// alertEngine.js — 告警引擎
// 延迟/错误率/成本阈值告警，支持 Webhook/日志/控制台
// =============================================================================

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

export function createAlertEngine(options = {}) {
  const alertLogDir = options.logDir ?? resolve(process.cwd(), ".data/alerts");
  if (!existsSync(alertLogDir)) mkdirSync(alertLogDir, { recursive: true });

  const rules = new Map();
  const alertHistory = [];
  const MAX_HISTORY = 5000;
  const cooldownMs = options.cooldownMs ?? 300_000; // 5 分钟冷却
  const lastAlertTime = new Map(); // ruleId -> lastTriggerTime
  const webhookUrls = options.webhookUrls ?? [];

  // 内置规则
  addRule({ id: "high_error_rate", name: "高错误率", metric: "errorRate", threshold: 0.05, operator: "gt", windowMs: 300_000, severity: "critical" });
  addRule({ id: "high_latency_p99", name: "P99 延迟过高", metric: "latencyP99", threshold: 10000, operator: "gt", windowMs: 300_000, severity: "warning" });
  addRule({ id: "daily_budget_90", name: "日预算 90%", metric: "dailyCostPercent", threshold: 90, operator: "gte", severity: "warning" });
  addRule({ id: "daily_budget_100", name: "日预算耗尽", metric: "dailyCostPercent", threshold: 100, operator: "gte", severity: "critical" });

  function addRule(rule) {
    rules.set(rule.id, { enabled: true, ...rule });
  }

  function removeRule(ruleId) {
    rules.delete(ruleId);
    lastAlertTime.delete(ruleId);
  }

  function evaluate(metrics) {
    const triggered = [];
    const now = Date.now();

    for (const [ruleId, rule] of rules) {
      if (!rule.enabled) continue;

      // 冷却检查
      const lastTime = lastAlertTime.get(ruleId) ?? 0;
      if (now - lastTime < cooldownMs) continue;

      const value = metrics[rule.metric];
      if (value === undefined) continue;

      let fired = false;
      switch (rule.operator) {
        case "gt": fired = value > rule.threshold; break;
        case "gte": fired = value >= rule.threshold; break;
        case "lt": fired = value < rule.threshold; break;
        case "lte": fired = value <= rule.threshold; break;
        case "eq": fired = value === rule.threshold; break;
      }

      if (fired) {
        lastAlertTime.set(ruleId, now);
        const alert = {
          id: randomUUID(),
          ruleId,
          ruleName: rule.name,
          severity: rule.severity,
          metric: rule.metric,
          value,
          threshold: rule.threshold,
          operator: rule.operator,
          timestamp: now,
          message: `[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.metric}=${value} (threshold: ${rule.operator} ${rule.threshold})`,
        };
        triggered.push(alert);
        alertHistory.push(alert);
        if (alertHistory.length > MAX_HISTORY) alertHistory.shift();
        dispatchAlert(alert);
      }
    }
    return triggered;
  }

  async function dispatchAlert(alert) {
    // 日志文件
    const today = new Date().toISOString().slice(0, 10);
    appendFileSync(resolve(alertLogDir, `alerts-${today}.jsonl`), JSON.stringify(alert) + "\n");

    // 控制台
    const prefix = alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "🟡" : "ℹ️";
    console.warn(`${prefix} [ALERT] ${alert.message}`);

    // Webhook
    for (const url of webhookUrls) {
      try {
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(alert),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) { console.error("[alertEngine]:", err?.message || err); }
    }
  }

  function getHistory(filter = {}) {
    let records = [...alertHistory];
    if (filter.severity) records = records.filter((a) => a.severity === filter.severity);
    if (filter.ruleId) records = records.filter((a) => a.ruleId === filter.ruleId);
    if (filter.since) records = records.filter((a) => a.timestamp >= filter.since);
    return records.slice(0, filter.limit ?? 50);
  }

  function getRules() { return Array.from(rules.values()); }

  function getHealth() {
    return {
      status: "ready",
      rules: rules.size,
      enabledRules: Array.from(rules.values()).filter((r) => r.enabled).length,
      alertsTriggered: alertHistory.length,
      webhookCount: webhookUrls.length,
    };
  }

  return { addRule, removeRule, evaluate, getHistory, getRules, getHealth };
}
