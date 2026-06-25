/**
 * Intent Router + Terminology Guard helpers for ConversationShell
 * 导出为模板字面量字符串，注入到 <script> 标签中。
 */

export const intentRouterClientJs = `
  // ─── Intent Router (client-side, mirrors lib/intentRouter.js) ───
  var V5_EXACT_MATCHES = {
    "\\u770B\\u770B\\u65E5\\u62A5": "DailyReportPanel",
    "\\u65E5\\u62A5": "DailyReportPanel",
    "\\u4ECA\\u5929\\u505A\\u4E86\\u4EC0\\u4E48": "DailyReportPanel",
    "\\u4ECA\\u5929\\u5B8C\\u6210\\u4EC0\\u4E48": "DailyReportPanel",
    "\\u5BA1\\u6279": "ApprovalPanel",
    "\\u5F85\\u5BA1\\u6279": "ApprovalPanel",
    "\\u6709\\u54EA\\u4E9B\\u8981\\u5BA1\\u6279\\u7684": "ApprovalPanel",
    "\\u5458\\u5DE5": "WorkforceStatusPanel",
    "\\u5458\\u5DE5\\u72B6\\u6001": "WorkforceStatusPanel",
    "\\u5458\\u5DE5\\u5728\\u5E72\\u561B": "WorkforceStatusPanel",
    "\\u6A21\\u578B": "ModelManagementPanel",
    "\\u6A21\\u578B\\u7BA1\\u7406": "ModelManagementPanel",
    "\\u76D1\\u63A7": "MonitoringPanel",
    "\\u7CFB\\u7EDF\\u72B6\\u6001": "MonitoringPanel",
    "\\u8BBE\\u7F6E": "ProviderConfigPanel",
    "\\u914D\\u7F6E": "ProviderConfigPanel",
    "\\u5B89\\u5168": "EngineeringToolsPanel",
    "\\u4F9D\\u4F9D": "YiyiSettingsPanel"
  };

  var V5_KEYWORD_RULES = [
    { kw: ["\\u65E5\\u62A5","\\u5B8C\\u6210","\\u4ECA\\u5929\\u505A\\u4E86","\\u7ED3\\u679C"], panel: "DailyReportPanel" },
    { kw: ["\\u5BA1\\u6279","\\u6279\\u51C6","\\u5F85\\u529E","\\u786E\\u8BA4"], panel: "ApprovalPanel" },
    { kw: ["\\u5458\\u5DE5","\\u8C01\\u5728","\\u5728\\u5E72\\u561B","\\u72B6\\u6001"], panel: "WorkforceStatusPanel" },
    { kw: ["\\u6A21\\u578B","model","\\u5207\\u6362\\u6A21\\u578B","\\u5EF6\\u8FDF"], panel: "ModelManagementPanel" },
    { kw: ["\\u76D1\\u63A7","\\u5065\\u5EB7","\\u5F02\\u5E38","\\u51FA\\u9519","\\u5931\\u8D25"], panel: "MonitoringPanel" },
    { kw: ["\\u8BBE\\u7F6E","\\u914D\\u7F6E","provider","\\u8FDE\\u63A5"], panel: "ProviderConfigPanel" },
    { kw: ["\\u5B89\\u5168","\\u62E6\\u622A","\\u5BC6\\u94A5","\\u98CE\\u9669"], panel: "EngineeringToolsPanel" },
    { kw: ["\\u4F9D\\u4F9D","yiyi","\\u966A\\u4F34","\\u6027\\u683C"], panel: "YiyiSettingsPanel" },
    { kw: ["\\u5DE5\\u7A0B","\\u8C03\\u8BD5","\\u8DEF\\u7531","god mode"], panel: "EngineeringToolsPanel" }
  ];

  var V5_PANEL_LABELS = {
    DailyReportPanel: "\\u65E5\\u62A5",
    ApprovalPanel: "\\u5BA1\\u6279",
    WorkforceStatusPanel: "\\u5458\\u5DE5\\u72B6\\u6001",
    MonitoringPanel: "\\u76D1\\u63A7",
    ModelManagementPanel: "\\u6A21\\u578B",
    ProviderConfigPanel: "\\u914D\\u7F6E",
    EngineeringToolsPanel: "\\u5DE5\\u7A0B",
    YiyiSettingsPanel: "\\u4F9D\\u4F9D"
  };

  // Map PascalCase panel names to kebab-case panel store IDs
  var V5_PANEL_ID_MAP = {
    DailyReportPanel: "daily-report",
    ApprovalPanel: "approval",
    WorkforceStatusPanel: "workforce-status",
    MonitoringPanel: "monitoring",
    ModelManagementPanel: "model-management",
    ProviderConfigPanel: "provider-config",
    WorkforceManagementPanel: "workforce-management",
    EngineeringToolsPanel: "engineering-tools",
    AdvancedPanel: "advanced",
    YiyiSettingsPanel: "yiyi-settings"
  };

  function v5RouteIntent(text) {
    var input = (text || "").trim().toLowerCase();
    if (!input) return { type: "chat" };

    // Level 1: Exact match
    if (V5_EXACT_MATCHES[input]) return { type: "panel", panel: V5_EXACT_MATCHES[input] };

    // Level 2: Keyword match
    for (var i = 0; i < V5_KEYWORD_RULES.length; i++) {
      var rule = V5_KEYWORD_RULES[i];
      for (var j = 0; j < rule.kw.length; j++) {
        if (input.indexOf(rule.kw[j]) !== -1) return { type: "panel", panel: rule.panel };
      }
    }

    // Level 3: Pattern match (look at / open / check)
    var lookMatch = input.match(/(?:\\u770B\\u770B|\\u6253\\u5F00|\\u67E5\\u770B)(.+)/);
    if (lookMatch) {
      var kw = lookMatch[1].trim();
      for (var pid in V5_PANEL_LABELS) {
        if (kw.indexOf(V5_PANEL_LABELS[pid]) !== -1 || V5_PANEL_LABELS[pid].indexOf(kw) !== -1) {
          return { type: "panel", panel: pid };
        }
      }
    }

    // Level 4: Fallback to chat
    return { type: "chat" };
  }

  // ─── Terminology Guard ───
  var V5_FORBIDDEN_TERMS = [
    "Provider", "God Mode", "Tianshu", "CredentialRef",
    "NVIDIA", "API Key", "Token", "endpoint",
    "dry-run", "worktree", "Phase", "pgvector",
    "embedding", "sandboxed", "evidence", "trace",
    "verifier", "fallback", "route", "latency"
  ];

  var V5_TERM_REPLACEMENTS = {
    "Provider": "\\u6A21\\u578B\\u670D\\u52A1",
    "God Mode": "\\u4E25\\u8C28\\u6A21\\u5F0F",
    "Tianshu": "\\u89C4\\u5212\\u6A21\\u5F0F",
    "CredentialRef": "\\u8FDE\\u63A5\\u914D\\u7F6E",
    "NVIDIA": "\\u6A21\\u578B\\u670D\\u52A1",
    "API Key": "\\u8FDE\\u63A5\\u5BC6\\u94A5",
    "dry-run": "\\u9884\\u89C8\\u6A21\\u5F0F",
    "fallback": "\\u5907\\u7528\\u65B9\\u6848",
    "route": "\\u8DEF\\u5F84",
    "latency": "\\u54CD\\u5E94\\u901F\\u5EA6"
  };
`;
