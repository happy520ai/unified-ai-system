/**
 * v5 ConversationShell Client JS — 客户端交互逻辑
 * 导出为模板字面量字符串，注入到 <script> 标签中。
 * 注意：所有 \" 必须用 \\" 双转义（因为在模板字面量内）。
 */

import { intentRouterClientJs } from "./intentRouterClientJs.js";

export const conversationShellClientJs = `
(function() {
  "use strict";

  // ─── ToneByStatus (client-side copy) ───
  var V5_STATUS_TONE_MAP = {
    normal:  { greeting: true, status: "一切正常", cta: "想做点什么？" },
    pending: { greeting: true, status: "有 {n} 件事等你确认", cta: "先看看？" },
    error:   { greeting: true, status: "刚才有个任务没跑成", cta: "要看看怎么回事吗？" },
    offline: { greeting: false, status: "系统暂时连不上", cta: "你可以先告诉我待会儿要做什么。" }
  };

  var V5_TIME_GREETINGS = [
    { before: 6, text: "夜深了" },
    { before: 9, text: "早上好" },
    { before: 12, text: "上午好" },
    { before: 14, text: "中午好" },
    { before: 18, text: "下午好" },
    { before: 22, text: "晚上好" },
    { before: 24, text: "夜深了" }
  ];

  function v5TimeGreeting() {
    var h = new Date().getHours();
    for (var i = 0; i < V5_TIME_GREETINGS.length; i++) {
      if (h < V5_TIME_GREETINGS[i].before) return V5_TIME_GREETINGS[i].text;
    }
    return "你好";
  }

  function v5ResolveTone(systemStatus, pendingCount) {
    var key = "normal";
    if (systemStatus === "error" || systemStatus === "warn") key = "error";
    else if (systemStatus === "offline") key = "offline";
    else if (pendingCount > 0) key = "pending";

    var entry = V5_STATUS_TONE_MAP[key];
    var statusText = entry.status;
    if (statusText.indexOf("{n}") !== -1) {
      statusText = statusText.replace("{n}", String(pendingCount));
    }

    var parts = [];
    if (entry.greeting) parts.push(v5TimeGreeting() + "。");
    parts.push(statusText);
    if (entry.cta) parts.push(entry.cta);

    return {
      key: key,
      fullText: parts.join(""),
      timeGreeting: v5TimeGreeting()
    };
  }

  var V5_ROLE_LABELS = { user: "你", system: "系统", assistant: "助手" };

  // ─── DOM helpers ───
  function v5ById(id) { return document.getElementById(id); }

  function v5EscapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = String(str || "");
    return d.innerHTML;
  }

${intentRouterClientJs}

  // ─── Dynamic Chips ───
  function v5RefreshChips() {
    var container = v5ById("v5-suggestions");
    if (!container) return;

    var systemStatus = "normal";
    var servicePill = v5ById("service-pill");
    if (servicePill) {
      var dot = servicePill.querySelector(".pill-dot");
      if (dot && dot.classList.contains("red")) systemStatus = "error";
    }
    var pendingCount = window.__v5PendingCount || 0;
    var lastAction = window.__v5LastAction || null;

    var chips = [];
    if (pendingCount > 0) chips.push({ id: "approval", label: "\\u5BA1\\u6279 " + pendingCount + " \\u9879", action: "open:ApprovalPanel" });
    if (systemStatus === "error") chips.push({ id: "error-check", label: "\\u67E5\\u770B\\u5F02\\u5E38", action: "open:MonitoringPanel" });
    chips.push({ id: "daily-report", label: "\\u770B\\u770B\\u65E5\\u62A5", action: "open:DailyReportPanel" });
    if (lastAction === "chat" || !lastAction) chips.push({ id: "workforce", label: "\\u5458\\u5DE5\\u5728\\u5E72\\u561B", action: "open:WorkforceStatusPanel" });
    chips.push({ id: "more", label: "\\u22EF \\u66F4\\u591A", action: "toggle-drawer" });
    chips = chips.slice(0, 5);

    container.innerHTML = "";
    for (var i = 0; i < chips.length; i++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "v5-chip";
      btn.setAttribute("data-v5-action", chips[i].action);
      btn.setAttribute("data-v5-chip-id", chips[i].id);
      btn.textContent = chips[i].label;
      container.appendChild(btn);
    }
  }

  // ─── 1. ToneByStatus: Update first line ───
  function v5UpdateFirstLine() {
    var textEl = v5ById("v5-first-text");
    if (!textEl) return;

    // Determine system status from existing pill data
    var servicePill = v5ById("service-pill");
    var systemStatus = "ok";
    if (servicePill) {
      var dot = servicePill.querySelector(".pill-dot");
      if (dot) {
        if (dot.classList.contains("red")) systemStatus = "offline";
        else if (dot.classList.contains("yellow")) systemStatus = "warn";
        else if (dot.classList.contains("gray")) systemStatus = "offline";
      }
    }

    // Count pending approvals from existing state
    var pendingCount = 0;
    try {
      if (window.__v5PendingCount !== undefined) {
        pendingCount = window.__v5PendingCount;
      }
    } catch(e) {
      console.debug("[v5] Could not read pending count from window: " + e.message);
    }

    var tone = v5ResolveTone(systemStatus, pendingCount);
    textEl.textContent = tone.fullText;
    textEl.setAttribute("data-tone", tone.key);
  }

  // ─── 2. ReplyField: Bubble chat ───
  function v5AppendBubble(role, text) {
    var conv = v5ById("v5-conversation");
    if (!conv) return;

    var bubble = document.createElement("div");
    bubble.className = "v5-bubble v5-bubble-" + role;

    var label = document.createElement("span");
    label.className = "v5-bubble-label";
    label.textContent = V5_ROLE_LABELS[role] || role;

    var body = document.createElement("div");
    body.className = "v5-bubble-body";
    body.textContent = text;

    bubble.appendChild(label);
    bubble.appendChild(body);
    conv.appendChild(bubble);

    // Auto-scroll to bottom
    conv.scrollTop = conv.scrollHeight;
  }

  function v5ShowTypingIndicator() {
    var conv = v5ById("v5-conversation");
    if (!conv) return;
    var indicator = document.createElement("div");
    indicator.className = "v5-bubble v5-bubble-system v5-typing";
    indicator.id = "v5-typing-indicator";
    indicator.innerHTML = "<span class=\\"v5-bubble-label\\">系统</span><div class=\\"v5-bubble-body v5-dots\\"><span></span><span></span><span></span></div>";
    conv.appendChild(indicator);
    conv.scrollTop = conv.scrollHeight;
  }

  function v5RemoveTypingIndicator() {
    var el = v5ById("v5-typing-indicator");
    if (el) el.remove();
  }

  async function v5SendMessage() {
    var input = v5ById("v5-input");
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    // Append user bubble
    v5AppendBubble("user", text);
    input.value = "";
    input.disabled = true;

    var sendBtn = v5ById("v5-send");
    if (sendBtn) sendBtn.disabled = true;

    // ─── Intent routing: intercept before server call ───
    var route = v5RouteIntent(text);
    if (route.type === "panel") {
      v5RemoveTypingIndicator();
      var panelLabel = V5_PANEL_LABELS[route.panel] || route.panel;
      v5AppendBubble("assistant", "\\u597D\\u7684\\uFF0C\\u5E2E\\u4F60\\u6253\\u5F00" + panelLabel + "\\u3002");
      window.__v5LastAction = route.panel;
      v5RefreshChips();
      // Open via card transition if available
      if (window.__v5CardTransition) {
        var chip = document.querySelector("[data-v5-action=\\\"open:" + route.panel + "\\\"]");
        if (chip) window.__v5CardTransition.expand(chip);
      }
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
      return;
    }

    v5ShowTypingIndicator();
    window.__v5LastAction = "chat";

    try {
      // Reuse existing requestJson if available, otherwise fetch directly
      var requestFn = window.__v5RequestJson || function(url, opts) {
        return fetch(url, opts).then(function(r) { return r.json(); });
      };

      var result = await requestFn("/chat-gateway/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          message: text,
          mode: "manual_model"
        })
      });

      v5RemoveTypingIndicator();

      var answer = "";
      if (result.completionVerified && result.finalAnswer) {
        answer = String(result.finalAnswer).trim();
      } else if (result.userVisibleSummary) {
        answer = result.userVisibleSummary;
      } else if (result.message) {
        answer = result.message;
      } else {
        answer = "\\u7CFB\\u7EDF\\u5DF2\\u6536\\u5230\\uFF0C\\u4F46\\u6682\\u65E0\\u8BE6\\u7EC6\\u56DE\\u590D\\u3002";
      }

      // Run terminology replacement on answer
      for (var term in V5_TERM_REPLACEMENTS) {
        if (answer.indexOf(term) !== -1) {
          answer = answer.split(term).join(V5_TERM_REPLACEMENTS[term]);
        }
      }

      v5AppendBubble(result.completionVerified ? "assistant" : "system", answer);
      v5RefreshChips();

      if (typeof state !== "undefined") {
        state.lastChatResult = result;
      }
    } catch (error) {
      v5RemoveTypingIndicator();
      v5AppendBubble("system", "\\u8BF7\\u6C42\\u5931\\u8D25\\uFF1A" + error.message);
    } finally {
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  }

  // ─── 3. SuggestionChips ───
  function v5HandleChipClick(action, chipEl) {
    // toggle-drawer: open the more drawer
    if (action === "toggle-drawer") {
      v5ToggleDrawer();
      return;
    }

    // open:PanelName → card transition + intent feedback
    if (action.indexOf("open:") === 0) {
      var panelId = action.slice(5);
      var panelLabel = V5_PANEL_LABELS[panelId] || panelId;
      var panelStoreId = V5_PANEL_ID_MAP[panelId] || panelId;
      v5AppendBubble("assistant", "\\u597D\\u7684\\uFF0C\\u5E2E\\u4F60\\u6253\\u5F00" + panelLabel + "\\u3002");
      window.__v5LastAction = panelId;

      // Trigger card transition with panel content
      if (window.__v5CardTransition && chipEl) {
        window.__v5CardTransition.expand(chipEl, panelStoreId);
      }
      return;
    }

    // Legacy: fill input with text (backward compatibility)
    var input = v5ById("v5-input");
    if (!input) return;
    var chipTexts = {
      "daily-report": "\\u770B\\u770B\\u4ECA\\u5929\\u7684\\u65E5\\u62A5",
      "pending-approvals": "\\u6709\\u54EA\\u4E9B\\u5F85\\u5BA1\\u6279\\u7684\\u4E8B\\u9879",
      "workforce-status": "\\u5458\\u5DE5\\u73B0\\u5728\\u90FD\\u5728\\u5E72\\u561B"
    };
    var text = chipTexts[action];
    if (text) {
      input.value = text;
      input.focus();
    }
  }

  // ─── 4. MoreDrawer ───
  function v5ToggleDrawer(open) {
    var drawer = v5ById("v5-more-drawer");
    var btn = v5ById("v5-more-button");
    if (!drawer) return;

    if (open === undefined) {
      open = drawer.hidden;
    }

    drawer.hidden = !open;
    if (btn) {
      btn.setAttribute("aria-expanded", String(open));
    }

    if (open) {
      drawer.classList.add("is-open");
      // Scroll drawer into view
      drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      drawer.classList.remove("is-open");
    }
  }

  // ─── 5. Terminology Guard ───
  function v5RunTerminologyGuard() {
    var shell = v5ById("v5-conversation-shell");
    if (!shell) return;

    // Clone shell and remove drawer body to avoid scanning panel terms
    var clone = shell.cloneNode(true);
    var drawerBody = clone.querySelector("#v5-drawer-body");
    if (drawerBody) drawerBody.remove();

    var text = clone.textContent || "";
    var violations = [];
    for (var i = 0; i < V5_FORBIDDEN_TERMS.length; i++) {
      if (text.indexOf(V5_FORBIDDEN_TERMS[i]) !== -1) {
        violations.push(V5_FORBIDDEN_TERMS[i]);
      }
    }

    if (violations.length > 0) {
      console.warn("[v5 terminology-guard] \\u7B2C\\u4E00\\u5C4F\\u672F\\u8BED\\u6CC4\\u9732:", violations);
    }

    // Also run replacement on bubble content
    var bubbles = shell.querySelectorAll(".v5-bubble-body");
    for (var b = 0; b < bubbles.length; b++) {
      var content = bubbles[b].textContent || "";
      var changed = false;
      for (var term in V5_TERM_REPLACEMENTS) {
        if (content.indexOf(term) !== -1) {
          content = content.split(term).join(V5_TERM_REPLACEMENTS[term]);
          changed = true;
        }
      }
      if (changed) bubbles[b].textContent = content;
    }
  }

  // ─── Event Bindings ───
  function v5InitEvents() {
    // Send on button click
    var sendBtn = v5ById("v5-send");
    if (sendBtn) {
      sendBtn.addEventListener("click", function() { v5SendMessage(); });
    }

    // Send on Enter (Shift+Enter keeps newline — but this is a single-line input)
    var input = v5ById("v5-input");
    if (input) {
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          v5SendMessage();
        }
      });
    }

    // Suggestion chips (delegate click)
    var suggestions = v5ById("v5-suggestions");
    if (suggestions) {
      suggestions.addEventListener("click", function(e) {
        var chip = e.target.closest(".v5-chip");
        if (chip) {
          var action = chip.getAttribute("data-v5-action");
          if (action) v5HandleChipClick(action, chip);
        }
      });
    }

    // More drawer toggle
    var moreBtn = v5ById("v5-more-button");
    if (moreBtn) {
      moreBtn.addEventListener("click", function() { v5ToggleDrawer(); });
    }

    var drawerClose = v5ById("v5-drawer-close");
    if (drawerClose) {
      drawerClose.addEventListener("click", function() { v5ToggleDrawer(false); });
    }

    // Close drawer on Escape
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        var drawer = v5ById("v5-more-drawer");
        if (drawer && !drawer.hidden) {
          v5ToggleDrawer(false);
        }
      }
    });
  }

  // ─── Public API ───
  window.__v5 = {
    updateFirstLine: v5UpdateFirstLine,
    appendBubble: v5AppendBubble,
    sendMessage: v5SendMessage,
    toggleDrawer: v5ToggleDrawer,
    runTerminologyGuard: v5RunTerminologyGuard,
    routeIntent: v5RouteIntent,
    refreshChips: v5RefreshChips
  };

  // ─── Init ───
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      v5InitEvents();
      setTimeout(v5UpdateFirstLine, 2000);
      setTimeout(v5RefreshChips, 2500);
      setTimeout(v5RunTerminologyGuard, 3000);
    });
  } else {
    v5InitEvents();
    setTimeout(v5UpdateFirstLine, 2000);
    setTimeout(v5RefreshChips, 2500);
    setTimeout(v5RunTerminologyGuard, 3000);
  }

  // Drawer card click delegation (card transition)
  document.addEventListener("click", function(e) {
    var card = e.target.closest(".v5-drawer-card");
    if (card && window.__v5CardTransition) {
      var panelAction = card.getAttribute("data-panel-action");
      window.__v5CardTransition.expand(card, panelAction);
    }
  });

  // Also re-update first line when metrics change (poll for pill changes)
  var v5MetricsPollCount = 0;
  var v5MetricsPoller = setInterval(function() {
    v5MetricsPollCount++;
    v5UpdateFirstLine();
    if (v5MetricsPollCount > 5) {
      clearInterval(v5MetricsPoller);
      setInterval(v5UpdateFirstLine, 30000);
    }
  }, 3000);

  // Periodic terminology guard
  setInterval(v5RunTerminologyGuard, 10000);

  console.log("[v5] ConversationShell client initialized (intent-router + dynamic-chips + card-transition)");
})();
`;
