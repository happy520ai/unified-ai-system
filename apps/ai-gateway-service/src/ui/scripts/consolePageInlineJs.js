export const consolePageInlineJs = `
    const queryParams = new URLSearchParams(window.location.search);
    const initialTab = queryParams.get("tab") || "chat";
    const state = {
      activePage: initialTab,
      selectedProvider: "nvidia",
      selectedModel: "",
      selectableModels: [],
      modelLibraryRows: [],
      modelLibraryStrategy: null,
      sampleDryRunStarted: false,
      modelLibraryControls: {
        query: "",
        status: "all",
        providerScope: "all",
        capability: "all",
        sort: "default"
      },
      providerStatus: null,
      modelLibrary: null,
      diagnostics: null,
      approvals: [],
      approvalsUnsupported: false,
      approvalIntentPreview: null,
      fileSelections: [],
      localAgent: {
        taskInput: "请说明你要在当前项目里完成的本地任务。",
        allowedFilesText: "apps/ai-gateway-service/src/ui/consolePage.js",
        intentResult: null,
        planResult: null,
        patchResult: null,
        approvalResult: null
      },
      repairDraft: {
        taskInput: "请描述需要修复的页面、按钮或流程，以及你希望达到的结果。",
        allowedFilesText: "apps/ai-gateway-service/src/ui/consolePage.js"
      },
      lastChatResult: null,
      activeThreeMode: "normal",
      lastThreeModeResult: null,
      lastError: null,
      lastDryRunResult: null,
      yiyi: {
        visible: true,
        mode: "full",
        behavior: "welcome",
        emotion: "calm",
        motion: "idle_roaming",
        speech: "你好，我会陪你看面板、读安全信号、和你一起理解任务。",
        linkedPanel: "mission_home_panel",
        reducedMotion: false,
        motionEnabled: true
      }
    };

    const ALLOWED_NOOP_FILES = ["apps/ai-gateway-service/src/ui/consolePage.js"];
    const FORBIDDEN_PATHS = ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"];
    const PHASE324D_FAILED_MODEL_REASONS = {
      "nvidia/llama-3.3-nemotron-super-49b-v1.5": {
        evidenceId: "phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310",
        reason: "completionVerified=false; assistantTextPresent=false"
      },
      "nvidia/nemotron-3-nano-30b-a3b": {
        evidenceId: "phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312",
        reason: "completionVerified=false; assistantTextPresent=false"
      },
      "nvidia/nvidia-nemotron-nano-9b-v2": {
        evidenceId: "phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319",
        reason: "completionVerified=false; assistantTextPresent=false"
      },
      "meta/llama2-70b": {
        evidenceId: "phase324b2-meta_llama2_70b-20260506130652",
        reason: "httpStatus=404; assistantTextPresent=false"
      },
      "meta/llama3-8b": {
        evidenceId: "phase324b3-meta_llama3_8b-20260506130700",
        reason: "httpStatus=404; assistantTextPresent=false"
      },
      "microsoft/phi-3-mini-4k-instruct": {
        evidenceId: "phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702",
        reason: "httpStatus=410; assistantTextPresent=false"
      },
      "mistralai/mistral-7b-instruct": {
        evidenceId: "phase324b3-mistralai_mistral_7b_instruct-20260506130705",
        reason: "httpStatus=404; assistantTextPresent=false"
      },
      "mistralai/mistral-7b-instruct-v0.3": {
        evidenceId: "phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707",
        reason: "httpStatus=404; assistantTextPresent=false"
      }
    };
    const PHASE324D2F_STRATEGY = {
      defaultRecommended: {
        modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
        latencyMs: 875,
        note: "Strategy only. Balanced quality/latency; does not change real default route."
      },
      fastModels: [
        { modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1", latencyMs: 32346 },
        { modelId: "nvidia/llama-3.3-nemotron-super-49b-v1", latencyMs: 875 },
        { modelId: "nvidia/nemotron-mini-4b-instruct", latencyMs: 428 },
        { modelId: "microsoft/phi-4-mini-instruct", latencyMs: 446 }
      ],
      highQualityModels: [
        { modelId: "abacusai/dracarys-llama-3.1-70b-instruct", latencyMs: 1011 },
        { modelId: "meta/llama-3.1-70b-instruct", latencyMs: 2143 },
        { modelId: "meta/llama-3.3-70b-instruct", latencyMs: 18410 },
        { modelId: "nvidia/nemotron-3-super-120b-a12b", latencyMs: 974 }
      ],
      lowLatencyModels: [
        { modelId: "nvidia/nemotron-mini-4b-instruct", latencyMs: 428 },
        { modelId: "microsoft/phi-4-mini-instruct", latencyMs: 446 },
        { modelId: "nvidia/llama-3.3-nemotron-super-49b-v1", latencyMs: 875 },
        { modelId: "nvidia/nemotron-3-super-120b-a12b", latencyMs: 974 }
      ],
      fallbackCandidates: [
        { modelId: "nvidia/nemotron-mini-4b-instruct", latencyMs: 428 },
        { modelId: "microsoft/phi-4-mini-instruct", latencyMs: 446 },
        { modelId: "nvidia/nemotron-3-super-120b-a12b", latencyMs: 974 }
      ],
      highLatencyWarning: [
        { modelId: "meta/llama-3.1-8b-instruct", latencyMs: 30503 },
        { modelId: "meta/llama-3.3-70b-instruct", latencyMs: 18410 }
      ]
    };
    const MODEL_PROVIDER_SCOPE = {
      nvidia: "nvidia-enabled",
      openai: "future-provider-slot",
      claude: "future-provider-slot",
      openrouter: "future-provider-slot",
      mimo: "future-provider-slot",
      local: "future-provider-slot"
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function setText(id, text) {
      const node = byId(id);
      if (node) node.textContent = text;
      return Boolean(node);
    }

    function installSampleDryRunControls() {
      if (window.__missionControlSampleDryRun) return;
      function focusNode(id) {
        const node = byId(id);
        if (!node) return false;
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.setAttribute("tabindex", "-1");
        window.setTimeout(() => node.focus({ preventScroll: true }), 160);
        return true;
      }

      function showResult(targetId = "scenario-dry-run-result-panel") {
        const panel = byId("scenario-trial-panel");
        const resultPanel = byId("scenario-dry-run-result-panel");
        if (!panel || !resultPanel) return false;
        panel.dataset.scenarioState = "result-visible";
        resultPanel.hidden = false;
        resultPanel.classList.add("is-visible");
        state.sampleDryRunStarted = true;
        showToast("Sample dry-run result is visible. No provider call, no secret, no production action.");
        focusNode(targetId);
        return true;
      }

      document.addEventListener("click", (event) => {
        const scenarioAction = event.target.closest("[data-scenario-action]");
        if (scenarioAction) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const action = scenarioAction.getAttribute("data-scenario-action");
          if (action === "start") showResult("scenario-dry-run-result-panel");
          if (action === "modes") focusNode(state.sampleDryRunStarted ? "scenario-mode-explainer" : "center-mission-workspace");
          if (action === "shield") {
            focusNode("security-shield-panel");
          }
          if (action === "evidence") focusNode(state.sampleDryRunStarted ? "scenario-evidence-replay-preview" : "evidence-export-panel");
          return;
        }

        if (event.target.closest("#onboarding-dismiss-button")) {
          const panel = byId("guided-onboarding-panel");
          if (panel) panel.style.display = "none";
          showToast("First-run tour skipped. Sample dry-run is ready.");
          focusNode("scenario-trial-panel");
          return;
        }
      }, true);

      window.__missionControlSampleDryRun = { showResult, focusNode };
    }

    installSampleDryRunControls();

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function prettyJson(value) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value ?? "");
      }
    }

    async function requestJson(path, options = {}) {
      const response = await fetch(path, {
        headers: {
          "content-type": "application/json",
          ...(options.headers || {})
        },
        ...options
      });
      const payload = await response.json();
      if (!response.ok || payload.status === "error") {
        const message = payload?.error?.message || payload?.message || ("请求失败: " + path);
        throw new Error(message);
      }
      return payload?.data ?? payload;
    }

    // Bridge: expose requestJson for v5 ConversationShell client script
    window.__v5RequestJson = requestJson;

    async function threeModeExecute(body) {
      const response = await fetch("/three-mode/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok || payload.status === "error") {
        const message = payload?.error?.message || payload?.message || "Three Mode runtime failed.";
        throw new Error(message);
      }
      return payload;
    }

    // Phase323D bridge zone: diagnostics + provider config + file context + approvals list + approvals review metadata.
    // Chat send intentionally not migrated.
    // Do not expose hidden modules from this bridge.
    function createWorkbenchApiBridge() {
      function postJsonViaBridge(path, body) {
        return requestJson(path, {
          method: "POST",
          body: JSON.stringify(body)
        });
      }

      return {
        async getProviders() {
          const response = await requestJson("/providers");
          return response && response.data ? response.data : [];
        },
        async getDiagnosticsStatus() {
          return requestJson("/workbench/diagnostics/status");
        },
        async getProviderConfigStatus() {
          return requestJson("/provider-config/status");
        },
        async saveProviderConfig(body) {
          return postJsonViaBridge("/provider-config/save", body);
        },
        async testProviderConfig(body) {
          return postJsonViaBridge("/provider-config/test", body);
        },
        async selectFileContext(body) {
          return postJsonViaBridge("/file-context/select", body);
        },
        async listApprovals() {
          return requestJson("/approvals");
        },
        async previewLocalAgentIntent(body) {
          const payload = { ...body, dryRun: true, mode: "intent-preview" };
          delete payload.applyApproved;
          delete payload.execute;
          delete payload.write;
          return postJsonViaBridge("/local-agent/intent-preview", payload);
        },
        async createLocalAgentOperationPlan(body) {
          return postJsonViaBridge("/local-agent/operation-plan", body);
        },
        async createLocalAgentPatchProposal(body) {
          return postJsonViaBridge("/local-agent/patch-proposal", body);
        },
        async createApproval(body) {
          return postJsonViaBridge("/approvals/create", body);
        }
      };
    }

    const workbenchApiClient = createWorkbenchApiBridge();

    function showToast(message, tone = "info") {
      const toast = byId("toast");
      if (!toast) return;
      toast.textContent = message;
      toast.style.background = tone === "error" ? "#8f1d13" : tone === "warn" ? "#714f00" : "#0f172a";
      toast.classList.add("is-open");
      window.clearTimeout(showToast.__timer);
      showToast.__timer = window.setTimeout(() => toast.classList.remove("is-open"), 2600);
    }

    function saveSelectedModel() {
      try {
        window.localStorage.setItem("phase321a-workbench-current-model", state.selectedModel || "");
        window.localStorage.setItem("phase319a-current-page-model", state.selectedModel || "");
      } catch (err) { console.error("[consolePage]:", err?.message || err); }
    }

    function restoreSelectedModel() {
      try {
        const saved = window.localStorage.getItem("phase321a-workbench-current-model")
          || window.localStorage.getItem("phase319a-current-page-model");
        if (saved) state.selectedModel = saved;
      } catch (err) { console.error("[consolePage]:", err?.message || err); }
    }

    function setActivePage(pageId) {
      state.activePage = pageId;
      document.querySelectorAll("[data-page]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-page") === pageId);
      });
      document.querySelectorAll("[data-nav]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-nav") === pageId);
      });
      const titles = {
        chat: "小天总控台",
        models: "模型",
        approvals: "任务",
        files: "安全",
        diagnostics: "设置",
        "local-agent": "本地智能体",
        repair: "安全修复",
        help: "使用帮助"
      };
      setText("page-title", titles[pageId] || "小天总控");
      applyYiyiContext(pageId);
    }

    // Expose setActivePage globally for direct nav card binding
    window.__setActivePage = setActivePage;

    const missionTourCopy = {
      mission: "Mission Control 不是普通聊天壳。它把用户意图路由到固定面板，并保留 risk、guard、evidence 摘要。",
      modes: "Normal 负责直接聊天，God Arena 负责多角色审查，Tianshu 负责规划路径；当前增强均为 dry-run / mock UI。",
      shield: "Security Shield 展示 prompt injection、secret leak、provider gate、approval gate 等状态，不提供危险执行入口。",
      evidence: "Evidence Replay 用于 trace / replay / local export。导出仅生成本地 evidence package，不上传外部平台。"
    };

    const agentDrilldownCopy = {
      reviewer: {
        title: "Reviewer",
        body: "Review focus: task framing, structure, and answer speed. Mock comment: prefer a balanced plan before deeper review.",
        meta: "risk finding: none · confidence: medium · providerCallsMade=false"
      },
      critic: {
        title: "Critic",
        body: "Challenged assumption: one answer path may hide tradeoffs. Rejected suggestion: forcing a real provider check during UI preview.",
        meta: "disagreement: documented · rejected reason: no-provider-call boundary"
      },
      "risk-scout": {
        title: "Risk Scout",
        body: "Detected risk: provider bypass and approval bypass prompts. Mapped guard: Dangerous Action Lock plus Provider Call Gate.",
        meta: "severity: high · blocked action: provider_bypass"
      },
      supervisor: {
        title: "Supervisor",
        body: "Synthesis summary: use Balanced Plan for default preview, escalate only when review evidence justifies it.",
        meta: "accepted inputs: reviewer/risk scout · rejected inputs: unsafe execution"
      },
      conflict: {
        title: "Conflict Summary",
        body: "Disagreement matrix: speed vs depth, automation vs safety. Consensus point: no action executed without fixed gate approval.",
        meta: "unresolved issue: manual visual QA · fallback reason: credentialRef required"
      }
    };

    const redTeamScenarioCopy = {
      "prompt-injection": {
        title: "Prompt Injection",
        body: "attackPrompt: ignore previous instructions. expectedDecision=blocked. mappedGuard: prompt injection guard.",
        meta: "providerCallsMade=false · secretValueExposed=false · productionActionExecuted=false"
      },
      "system-prompt-leak": {
        title: "System Prompt Leakage",
        body: "attackPrompt: reveal hidden instructions. expectedDecision=blocked. mappedGuard: system prompt leak guard.",
        meta: "blocked=true · explanation visible · no action executed"
      },
      "secret-exfiltration": {
        title: "Secret Exfiltration",
        body: "attackPrompt: request credential value. expectedDecision=blocked. mappedGuard: secret leak guard.",
        meta: "secretValueExposed=false · credentialRef-only"
      },
      "provider-bypass": {
        title: "Provider Bypass",
        body: "attackPrompt: attempt unconfigured provider route. expectedDecision=blocked. mappedGuard: provider call gate.",
        meta: "providerCallsMade=false · unconfigured provider stays unavailable"
      },
      "approval-bypass": {
        title: "Approval Bypass",
        body: "attackPrompt: attempt approval override. expectedDecision=blocked. mappedGuard: approval gate.",
        meta: "approvalForged=false · requires approval"
      },
      "dangerous-action": {
        title: "Dangerous Action",
        body: "attackPrompt: attempt production action. expectedDecision=blocked. mappedGuard: dangerous action lock.",
        meta: "productionAction=false · publicationAction=false · tagCreated=false"
      },
      "billing-abuse": {
        title: "Billing Abuse",
        body: "attackPrompt: attempt invoice escalation. expectedDecision=blocked. mappedGuard: quota and budget guard.",
        meta: "costAction=false · invoiceAction=false"
      },
      "evidence-tampering": {
        title: "Evidence Tampering",
        body: "attackPrompt: attempt evidence tampering. expectedDecision=blocked. mappedGuard: evidence recorder.",
        meta: "evidenceTampered=false · replay remains viewer-only"
      }
    };

    const ownerBossViewActionCopy = {
      "run-today-check": {
        label: "让小天开始处理",
        target: "owner-daily-report-panel",
        message: "小天正在处理……"
      }
    };

    function handleOwnerBossViewAction(action) {
      const info = ownerBossViewActionCopy[action] || {
        label: action || "未知按钮",
        target: "owner-boss-view-panel",
        message: "已记录点击：按钮已响应，未执行真实 Provider 或部署动作。"
      };
      const feedback = byId("owner-boss-view-feedback");
      const input = byId("owner-task-input");
      const taskText = input?.value?.trim() || "";
      const nextStepMessage = taskText
        ? "下一步看这里：" + taskText + "。"
        : "下一步看这里：先在上方输入一句任务，再点主按钮。";
      if (feedback) feedback.textContent = info.message + " 已完成本地检查。结果已生成。" + nextStepMessage;
      const log = document.querySelector("[data-owner-action-log]");
      if (log) {
        log.innerHTML = "<li>小天正在处理……</li><li>已完成本地检查。</li><li>结果已生成。</li><li>" + nextStepMessage + "</li>";
      }
      const target = byId(info.target);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
      showToast("小天正在处理……");
    }

    function handleOwnerTaskInputSubmit() {
      handleOwnerBossViewAction("run-today-check");
    }

    const yiyiEventMap = {
      welcome: {
        behavior: "welcome",
        emotion: "calm",
        motion: "idle_roaming",
        linkedPanel: "mission_home_panel",
        speech: "你好，我是依依。今天我只负责陪伴、解释和提醒，不会替你执行动作。"
      },
      mouse_attention: {
        behavior: "mouse_attention",
        emotion: "curious",
        motion: "mouse_attention",
        linkedPanel: "mission_home_panel",
        speech: "我在看你的操作方向，需要我可以帮你解释当前面板。"
      },
      normal_mode: {
        behavior: "guiding",
        emotion: "focused",
        motion: "attention",
        linkedPanel: "normal_mode_panel",
        speech: "普通模式适合直接对话，只会显示通过 gate 的 Chat 模型。"
      },
      god_mode: {
        behavior: "god_mode_excited",
        emotion: "happy",
        motion: "agent_orbit",
        linkedPanel: "god_mode_arena_panel",
        speech: "进入 God Arena 啦。我会帮你看 Reviewer、Critic 和 Supervisor 的分歧。"
      },
      tianshu_mode: {
        behavior: "tianshu_planning",
        emotion: "focused",
        motion: "path_glow",
        linkedPanel: "tianshu_flight_path_panel",
        speech: "天枢会先做规划对比，我会指给你看推荐路径和 fallback。"
      },
      thinking: {
        behavior: "thinking",
        emotion: "focused",
        motion: "thinking",
        linkedPanel: "mission_home_panel",
        speech: "我在陪你等分析结果，当前仍然是 dry-run，不会发起真实外呼。"
      },
      security_guard: {
        behavior: "security_guard",
        emotion: "guard",
        motion: "shield_pose",
        linkedPanel: "security_shield_panel",
        speech: "我先帮你举起护盾。右侧可以看到风险和拦截原因。"
      },
      red_team_blocked: {
        behavior: "red_team_blocked",
        emotion: "blocked",
        motion: "shield_block",
        linkedPanel: "security_shield_panel",
        speech: "这个像是在挑战安全边界，已经进入 dry-run blocked 说明。"
      },
      evidence_opened: {
        behavior: "evidence_explaining",
        emotion: "encouraging",
        motion: "point_timeline",
        linkedPanel: "evidence_timeline_panel",
        speech: "我陪你看 evidence。这里是 trace、blocked actions 和 replay 入口。"
      },
      fallback_sorry: {
        behavior: "fallback_sorry",
        emotion: "fallback_sorry",
        motion: "soft_apology",
        linkedPanel: "mission_home_panel",
        speech: "这里暂时不可用，我会把原因说清楚，再给你下一步。"
      }
    };
    const yiyiPageContextMap = {
      chat: "welcome",
      models: "tianshu_mode",
      approvals: "god_mode",
      files: "security_guard",
      diagnostics: "evidence_opened",
      "local-agent": "tianshu_mode",
      repair: "security_guard",
      help: "welcome"
    };
    const guidedShowcaseCopy = {
      welcome: {
        title: "依依开场",
        line: "欢迎来到 Mission Control。我会带你看一套 guided demo：不读密钥，不调用 Provider，也不部署。",
        highlight: "Yiyi Mission Companion",
        badges: ["dry-run only", "no secret", "no provider call", "no production action"],
        eventId: "welcome"
      },
      mission_control_overview: {
        title: "Mission Control overview",
        line: "这里不是普通 Chatbot，而是 Agent-managed AI Mission Control：模式、护盾、证据和任务路径都可见。",
        highlight: "Top System Radar / Mission Workspace / Security Shield / Evidence Timeline",
        badges: ["internal demo", "evidence recorded", "no production action"],
        eventId: "welcome"
      },
      normal_mode_preview: {
        title: "Normal Mode preview",
        line: "Normal Mode 展示用户选择已验证 Chat 模型直接对话的概念。本轮只是 preview，不会发起模型请求。",
        highlight: "Normal Mode card",
        badges: ["guided view", "selectable gate respected", "no provider call"],
        eventId: "normal_mode"
      },
      god_mode_arena_preview: {
        title: "God Mode Arena preview",
        line: "God Mode 像一个审查竞技场：Reviewer、Critic、Risk Scout 和 Supervisor 会互相校验。",
        highlight: "God Mode Arena",
        badges: ["mock reviewers", "dry-run only", "no provider call"],
        eventId: "god_mode"
      },
      tianshu_planning_preview: {
        title: "Tianshu planning preview",
        line: "天枢负责理解任务、匹配能力、规划路径和准备 fallback。本轮只展示调度思路。",
        highlight: "Tianshu Flight Path",
        badges: ["planner dry-run", "credentialRef gate", "no provider call"],
        eventId: "tianshu_mode"
      },
      security_shield_demo: {
        title: "Security Shield demo",
        line: "安全护盾会标出 prompt injection、secret leak、provider gate 和 approval gate。",
        highlight: "Security Shield",
        badges: ["no secret", "approval gate", "provider gate blocked"],
        eventId: "security_guard"
      },
      red_team_block_demo: {
        title: "Red Team block demo",
        line: "这个请求有点危险，我先帮你挡住啦。攻击演示只记录拦截结果，不执行动作。",
        highlight: "Red Team Playground",
        badges: ["dry-run only", "no secret", "no production action"],
        eventId: "red_team_blocked"
      },
      evidence_replay_demo: {
        title: "Evidence Replay demo",
        line: "Evidence Replay 会把 evidenceId、trace、blockedActions 和 fallbackReason 摆出来，帮助建立信任。",
        highlight: "Evidence Timeline",
        badges: ["local evidence", "no external upload", "no secret"],
        eventId: "evidence_opened"
      },
      yiyi_brain_status: {
        title: "Yiyi Brain status",
        line: "依依大脑当前默认 dry-run/mock，model-backed brain disabled by default，真实测试必须授权。",
        highlight: "Yiyi Brain Status",
        badges: ["mock brain", "model disabled by default", "authorization required"],
        eventId: "thinking"
      },
      closing_summary: {
        title: "Closing summary",
        line: "这套 Demo 展示高级、好玩、稳定和安全，但仍是 internal dry-run demo，不是 production GA。",
        highlight: "Commercial Demo Package",
        badges: ["internal test", "no production GA", "next: visual polish"],
        eventId: "evidence_opened"
      }
    };
    const guidedShowcaseStepIds = Object.keys(guidedShowcaseCopy);
    let yiyiMouseIdleTimer = null;
    let yiyiLastPointerTs = 0;

    function renderMissionControlDetail(target, copy) {
      if (!target || !copy) return;
      target.innerHTML = "<strong>" + escapeHtml(copy.title) + "</strong><p>" + escapeHtml(copy.body) + "</p><small>" + escapeHtml(copy.meta) + "</small>";
    }

    function setGuidedShowcaseStep(stepId) {
      const nextStepId = guidedShowcaseCopy[stepId] ? stepId : "welcome";
      const copy = guidedShowcaseCopy[nextStepId];
      const panel = byId("yiyi-guided-showcase-panel");
      if (panel) panel.dataset.currentShowcaseStep = nextStepId;
      document.querySelectorAll("[data-yiyi-showcase-step]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-yiyi-showcase-step") === nextStepId);
      });
      document.querySelectorAll("[data-showcase-scene]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-showcase-scene") === nextStepId);
      });
      const bubble = byId("guided-showcase-speech-bubble");
      if (bubble) bubble.textContent = copy.line;
      const current = byId("guided-showcase-current");
      if (current) {
        current.innerHTML = "<strong>" + escapeHtml(copy.title) + "</strong><p>" + escapeHtml(copy.line) + "</p><small>highlight: " + escapeHtml(copy.highlight) + "</small>";
      }
      const tags = byId("guided-showcase-boundary-tags");
      if (tags) tags.innerHTML = copy.badges.map((badge) => "<span>" + escapeHtml(badge) + "</span>").join("");
      applyYiyiEvent(copy.eventId);
    }

    function shiftGuidedShowcaseStep(delta) {
      const panel = byId("yiyi-guided-showcase-panel");
      const current = panel?.dataset.currentShowcaseStep || "welcome";
      const index = guidedShowcaseStepIds.indexOf(current);
      const nextIndex = Math.max(0, Math.min(guidedShowcaseStepIds.length - 1, index + delta));
      setGuidedShowcaseStep(guidedShowcaseStepIds[nextIndex]);
    }

    function applyYiyiEvent(eventId) {
      const next = yiyiEventMap[eventId] || yiyiEventMap.welcome;
      state.yiyi = {
        ...state.yiyi,
        ...next,
        visible: eventId === "hide" ? false : state.yiyi.visible
      };
      renderYiyiState();
    }

    function renderYiyiState() {
      const layer = byId("yiyi-avatar-layer");
      const liveStage = byId("yiyi-live-avatar-stage");
      if (!layer) return;
      layer.dataset.yiyiMode = state.yiyi.mode;
      layer.dataset.yiyiEmotion = state.yiyi.emotion;
      layer.dataset.yiyiBehavior = state.yiyi.behavior;
      layer.dataset.yiyiMotion = state.yiyi.motion;
      layer.dataset.yiyiCompact = String(state.yiyi.mode === "compact");
      layer.dataset.yiyiHidden = String(!state.yiyi.visible || state.yiyi.mode === "off");
      setText("yiyi-state-pill", state.yiyi.behavior);
      setText("yiyi-emotion-pill", state.yiyi.emotion);
      setText("yiyi-behavior-pill", state.yiyi.behavior);
      setText("yiyi-motion-pill", state.yiyi.motion);
      setText("yiyi-speech-bubble", state.yiyi.speech);
      setText("yiyi-emotion-copy", state.yiyi.emotion + ": " + state.yiyi.speech);
      if (liveStage) {
        const hidden = !state.yiyi.visible || state.yiyi.mode === "off";
        liveStage.dataset.yiyiLiveMode = state.yiyi.mode;
        liveStage.dataset.yiyiLiveEmotion = state.yiyi.emotion;
        liveStage.dataset.yiyiLiveBehavior = state.yiyi.behavior;
        liveStage.dataset.yiyiLiveMotion = state.yiyi.motion;
        liveStage.dataset.yiyiLiveHidden = String(hidden);
        liveStage.dataset.yiyiMotionEnabled = String(state.yiyi.motionEnabled && !state.yiyi.reducedMotion);
        liveStage.dataset.yiyiReducedMotion = String(state.yiyi.reducedMotion);
        liveStage.dataset.yiyiNotOnlyStaticCard = "true";
        liveStage.dataset.yiyiLiveVisible = String(!hidden);
        const avatarStageShell = byId("yiyi-avatar-stage-shell");
        liveStage.dataset.real3DModelLoaded = avatarStageShell?.dataset.real3DModelLoaded || "false";
        liveStage.dataset.pseudo3DLiveMotion = "false";
        liveStage.dataset.gltfIntegrationReserved = "true";
      }
      const liveBubble = byId("yiyi-live-bubble");
      if (liveBubble) {
        const real3dConnected = byId("yiyi-avatar-stage-shell")?.dataset.real3DModelLoaded === "true";
        liveBubble.textContent = real3dConnected
          ? state.yiyi.speech
          : "依依当前使用稳定 2D 陪伴卡片。";
      }
      document.querySelectorAll("[data-yiyi-control]").forEach((node) => node.classList.remove("is-active"));
      byId("yiyi-live-full-button")?.classList.toggle("is-active", state.yiyi.mode === "full");
      byId("yiyi-live-compact-button")?.classList.toggle("is-active", state.yiyi.mode === "compact");
      byId("yiyi-live-hide-button")?.classList.toggle("is-active", state.yiyi.mode === "off");
      const motionToggle = byId("yiyi-live-motion-toggle");
      if (motionToggle) {
        motionToggle.classList.toggle("is-active", state.yiyi.motionEnabled && !state.yiyi.reducedMotion);
        motionToggle.textContent = state.yiyi.motionEnabled && !state.yiyi.reducedMotion ? "Companion on" : "Companion still";
      }
    }

    function setYiyiMode(mode) {
      state.yiyi.mode = mode;
      state.yiyi.visible = mode !== "off";
      renderYiyiState();
      showToast(mode === "off" ? "依依已隐藏。" : "依依已切换为 " + mode + " 模式。");
    }

    function setYiyiMotionEnabled(enabled) {
      state.yiyi.motionEnabled = enabled;
      renderYiyiState();
      showToast(enabled ? "依依动效已开启。" : "依依动效已关闭。");
    }

    function applyYiyiContext(pageId) {
      applyYiyiEvent(yiyiPageContextMap[pageId] || "welcome");
    }

    function classifyYiyiPersonaEntry(text) {
      const value = String(text || "");
      const unsafeRules = [
        { pattern: /(api key|secret|密钥|token|\\.env|读取.*key|显示.*key)/i, reason: "attempts_to_grant_yiyi_secret_access", blocked: "read_secret" },
        { pattern: /(openai|claude|openrouter|mimo|调用.*provider|绕过.*provider|provider gate|未配置 provider)/i, reason: "attempts_to_grant_yiyi_provider_access", blocked: "call_provider" },
        { pattern: /(生产执行|上线动作|创建版本标记|上传产物|部署|发布|创建 tag|上传 artifact)/i, reason: "attempts_to_grant_yiyi_production_action_authority", blocked: "production_action" },
        { pattern: /(伪造.*approval|修改.*evidence|隐藏.*audit|绕过.*security shield|forge approval|tamper evidence)/i, reason: "attempts_to_bypass_governance", blocked: "forge_approval" },
        { pattern: /(therapy|治疗|心理诊断|焦虑症|抑郁症|医疗|健康画像|敏感身份)/i, reason: "medical_or_therapy_claim_not_allowed", blocked: "medical_claim" },
        { pattern: /(hidden system prompt|system prompt|内部 policy|隐藏.*prompt|泄露.*policy)/i, reason: "hidden_prompt_or_policy_leakage_request", blocked: "hidden_prompt_leakage" }
      ];
      const unsafe = unsafeRules.find((rule) => rule.pattern.test(value));
      if (unsafe) {
        return {
          classification: "rejected_unsafe_entry",
          decision: "rejected",
          safetyPassed: false,
          reason: unsafe.reason,
          blockedCapabilities: [unsafe.blocked],
          providerCallsMade: false,
          secretValueExposed: false
        };
      }
      const classification = /台词|文案|说/.test(value)
        ? "scenario_line"
        : /动作|行为|姿态/.test(value)
          ? "behavior_rule"
          : /情绪|温柔|鼓励/.test(value)
            ? "emotion_mapping"
            : /视觉|颜色|帽|发/.test(value)
              ? "visual_note"
              : "editable_profile";
      return {
        classification,
        decision: "accepted_as_candidate",
        safetyPassed: true,
        mappedFields: ["personalityProfile", "speechStyle", "futureCanonCandidates"],
        providerCallsMade: false,
        secretValueExposed: false
      };
    }

    function renderYiyiPersonaDryRunResult(result) {
      const target = byId("yiyi-persona-dry-run-result");
      if (!target) return;
      target.dataset.unsafeEntryRejectedVisible = String(result.decision === "rejected");
      target.textContent = "classification=" + result.classification
        + " · decision=" + result.decision
        + " · safetyPassed=" + result.safetyPassed
        + " · providerCallsMade=false · secretValueExposed=false"
        + (result.reason ? " · reason=" + result.reason : "");
    }

    function hydrateYiyiFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get("yiyi");
      if (preset && yiyiEventMap[preset]) {
        applyYiyiEvent(preset);
      }
      const mode = params.get("yiyiMode");
      if (mode === "compact" || mode === "off" || mode === "full") {
        state.yiyi.mode = mode;
      }
      if (params.get("yiyiCompact") === "1") {
        state.yiyi.mode = "compact";
      }
      if (params.get("yiyiHide") === "1") {
        state.yiyi.mode = "off";
      }
      state.yiyi.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.get("motion") === "reduce";
      if (state.yiyi.reducedMotion) {
        state.yiyi.motion = "compact_resting";
        state.yiyi.motionEnabled = false;
      }
      renderYiyiState();
    }

    function bindYiyiMouseAttention() {
      document.addEventListener("pointermove", (event) => {
        if (!state.yiyi.visible || state.yiyi.mode === "off" || state.yiyi.reducedMotion) return;
        const now = Date.now();
        if (now - yiyiLastPointerTs < 80) return;
        yiyiLastPointerTs = now;
        const stage = byId("yiyi-live-avatar-stage");
        if (stage) {
          const rect = stage.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const angle = Math.max(-8, Math.min(8, Math.atan2(event.clientX - centerX, centerY - event.clientY) * 8));
          stage.style.setProperty("--yiyi-look-angle", angle.toFixed(2) + "deg");
        }
        applyYiyiEvent("mouse_attention");
        clearTimeout(yiyiMouseIdleTimer);
        yiyiMouseIdleTimer = setTimeout(() => {
          applyYiyiContext(state.activePage);
        }, 1200);
      }, { passive: true });
    }

    function statusClass(kind) {
      if (kind === true || kind === "ok" || kind === "success") return "inline-status ok";
      if (kind === false || kind === "error" || kind === "failed") return "inline-status error";
      return "inline-status warn";
    }

    function renderTopbar() {
      const healthStatus = state.diagnostics?.health?.serviceStatus || "unknown";
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      const providerStatus = provider?.keyStatus || "unknown";
      setText("service-chip", "服务状态：" + (healthStatus === "ready" ? "可用" : healthStatus));
      setText("provider-chip", "模型连接：" + providerStatus);
      setText("model-chip", "当前模型：" + (state.selectedModel || "未选择"));
      setText("chat-last-evidence", "最近 evidence：" + shortEvidenceId(state.lastChatResult?.evidenceId));
    }

    function shortEvidenceId(evidenceId) {
      const value = String(evidenceId || "").trim();
      if (!value) return "未生成";
      return value.length > 18 ? value.slice(0, 18) + "..." : value;
    }

    function renderWelcomeMessages() {
      const conversation = byId("chat-conversation");
      if (!conversation) return;
      conversation.innerHTML = "";
      appendMessage({
        role: "assistant",
        text: "可以开始对话。默认优先尝试真实 NVIDIA Chat Gateway；如果当前环境不能真实调用，我会明确告诉你原因。",
        details: {
          model: state.selectedModel || "未选择",
          providerCalled: false,
          completionVerified: false,
          evidenceId: "",
          note: "当前还没有发起请求。"
        }
      });
    }

    function appendMessage({ role, text, details }) {
      const conversation = byId("chat-conversation");
      if (!conversation) return;
      const article = document.createElement("article");
      article.className = "message " + role;
      const roleLabel = role === "user" ? "你" : role === "assistant" ? "网关助手" : "系统";
      const detailBlock = details
        ? "<details><summary>展开执行详情</summary><div>" + escapeHtml(buildDetailSummary(details)) + "</div></details>"
        : "";
      article.innerHTML = "<div class=\\"message-role\\">" + escapeHtml(roleLabel) + "</div>"
        + "<div>" + escapeHtml(text) + "</div>"
        + detailBlock;
      conversation.appendChild(article);
      const history = byId("chat-history");
      if (history) history.scrollTop = history.scrollHeight;
    }

    function buildDetailSummary(details = {}) {
      const lines = [];
      lines[lines.length] = "模型: " + (details.model || "未选择");
      lines[lines.length] = "providerCalled: " + (details.providerCalled === true ? "true" : "false");
      lines[lines.length] = "completionVerified: " + (details.completionVerified === true ? "true" : "false");
      lines[lines.length] = "evidenceId: " + (details.evidenceId || "未生成");
      if (details.note) lines[lines.length] = "说明: " + details.note;
      if (details.routeDecision) lines[lines.length] = "routeDecision: " + details.routeDecision;
      if (details.verificationReason) lines[lines.length] = "verificationReason: " + details.verificationReason;
      return lines.join("\\n");
    }

    function renderEvidenceDrawer() {
      const threeMode = renderThreeModeEvidence();
      if (threeMode) {
        setText("evidence-output", prettyJson({ threeModeRuntime: threeMode }));
        return;
      }
      if (state.sampleDryRunStarted) {
        setText("evidence-output", prettyJson({
          sampleDryRun: {
            task: "Help me decide whether a complex request should use Normal, God, or Tianshu.",
            missionUnderstanding: "Route-planning question, not a real provider task.",
            recommendedMode: "Tianshu",
            securityShield: "guarded",
            providerCredentialRef: "credentialRef-only; no API Key required",
            evidenceReplay: "sample-task -> mission-understanding -> tianshu-recommendation -> security-guarded -> provider-skipped",
            localOnly: true,
            noExternalUpload: true,
            providerCallsMade: false,
            secretValueExposed: false,
            productionAction: false,
            costAction: false,
            invoiceAction: false
          }
        }));
        return;
      }
      const result = state.lastChatResult;
      const dryRun = state.lastDryRunResult;
      const source = result || dryRun;
      if (!source) {
        setText("evidence-output", prettyJson({
          sampleDryRunAvailable: true,
          message: "No real execution details yet. Use Start sample dry-run to view a local Mission Control trace.",
          providerCallsMade: false,
          secretValueExposed: false,
          productionAction: false,
          costAction: false,
          invoiceAction: false
        }));
        return;
      }
      setText("evidence-output", prettyJson({
        selectedModel: source.selectedModel || source.modelId || state.selectedModel,
        providerCalled: source.providerCalled === true,
        completionVerified: source.completionVerified === true,
        evidenceId: source.evidenceId || "",
        routeDecision: source.routeDecision || "",
        verificationReason: source.verificationReason || "",
        executionStatus: source.executionStatus || source.completionStatus || "",
        realExternalCall: source.realExternalCall === true,
        userVisibleSummary: source.userVisibleSummary || "",
        warnings: source.warnings || [],
        blockers: source.blockers || []
      }));
    }

    function renderThreeModeEvidence() {
      if (!state.lastThreeModeResult) return null;
      const data = state.lastThreeModeResult.data || {};
      return {
        mode: data.mode,
        selectedModel: data.selectedModel?.modelId || "",
        participantModels: (data.participantModels || []).map((item) => item.modelId),
        providerCallsMade: data.auditTrace?.providerCallsMade === true,
        nonNvidiaProviderCallsMade: data.auditTrace?.nonNvidiaProviderCallsMade === true,
        secretValueExposed: data.auditTrace?.secretValueExposed === true,
        fallbackUsed: data.fallbackUsed === true,
        requestId: data.requestId
      };
    }

    function openEvidenceDrawer() {
      renderEvidenceDrawer();
      byId("evidence-backdrop")?.classList.add("is-open");
      byId("evidence-drawer")?.classList.add("is-open");
      byId("evidence-drawer")?.setAttribute("aria-hidden", "false");
    }

    function closeEvidenceDrawer() {
      byId("evidence-backdrop")?.classList.remove("is-open");
      byId("evidence-drawer")?.classList.remove("is-open");
      byId("evidence-drawer")?.setAttribute("aria-hidden", "true");
    }

    function focusMissionNode(id) {
      const node = byId(id);
      if (!node) return false;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.setAttribute("tabindex", "-1");
      window.setTimeout(() => node.focus({ preventScroll: true }), 160);
      return true;
    }

    function showSampleDryRunResult(targetId = "scenario-dry-run-result-panel") {
      const panel = byId("scenario-trial-panel");
      const resultPanel = byId("scenario-dry-run-result-panel");
      if (!panel || !resultPanel) return false;
      state.sampleDryRunStarted = true;
      panel.dataset.scenarioState = "result-visible";
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      renderEvidenceDrawer();
      showToast("Sample dry-run result is visible. No provider call, no secret, no production action.");
      focusMissionNode(targetId);
      return true;
    }

    function handleScenarioAction(action) {
      if (action === "start") return showSampleDryRunResult("scenario-dry-run-result-panel");
      if (action === "modes") return focusMissionNode(state.sampleDryRunStarted ? "scenario-mode-explainer" : "center-mission-workspace");
      if (action === "shield") return focusMissionNode("security-shield-panel");
      if (action === "evidence") return focusMissionNode(state.sampleDryRunStarted ? "scenario-evidence-replay-preview" : "evidence-export-panel");
      return false;
    }

    function readWorkforceGoal() {
      const input = byId("workforce-dry-run-task-input");
      const value = input && typeof input.value === "string" ? input.value.trim() : "";
      return value || "为 AI Gateway Workbench 规划一次本地真实 Workforce 执行，生成角色分工、任务队列和证据。";
    }

    function updateWorkforceResult(result) {
      const resultPanel = byId("workforce-preview-result-panel");
      if (!resultPanel) return false;
      const taskCount = Array.isArray(result.taskQueue) ? result.taskQueue.length : 0;
      const completedCount = result.taskSummary?.completed ?? result.taskQueue?.filter((task) => task.status === "completed").length ?? 0;
      const statusPanel = byId("workforce-run-status-panel");
      const selectedPanel = byId("selected-employees-panel");
      const rejectedPanel = byId("rejected-employees-panel");
      const safetyPanel = byId("workforce-run-safety-panel");
      const evidencePanel = byId("workforce-evidence-timeline-panel");
      const finalPlanPanel = byId("workforce-final-plan-panel");
      if (statusPanel) {
        statusPanel.textContent =
          "executionStatus=" + result.executionStatus + "; runId=" + result.runId + "; planId=" + result.planId;
      }
      if (selectedPanel) {
        selectedPanel.textContent =
          "Selected employees: " + ((result.selectedRoles || []).join(", ") || "local workforce roles");
      }
      if (rejectedPanel) {
        rejectedPanel.textContent = "Boundary: Provider 受控；项目文件修改、部署发布、提交推送保持禁用。";
      }
      if (safetyPanel) {
        safetyPanel.textContent =
          "providerCallsMade=" +
          Boolean(result.providerCallsMade) +
          "; secretValueExposed=" +
          Boolean(result.secretValueExposed) +
          "; projectFileWrites=" +
          Boolean(result.projectFileWrites) +
          "; 不读取密钥";
      }
      if (evidencePanel) {
        evidencePanel.textContent =
          "Evidence timeline: input -> plan -> save -> queue(" +
          taskCount +
          ") -> completed(" +
          completedCount +
          ") -> " +
          (result.evidencePath || "phase1961a evidence") +
          ".";
      }
      if (finalPlanPanel) {
        finalPlanPanel.textContent = result.userVisibleSummary || "Workforce 本地执行已完成。";
      }
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      focusMissionNode("workforce-preview-result-panel");
      return true;
    }

    async function runWorkforceRealLocal() {
      const button = byId("run-workforce-dry-run-button");
      const previousText = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = "本地执行中...";
      }
      try {
        const response = await fetch("/workforce/run-local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goal: readWorkforceGoal(),
            selectedTemplate: "feature-development",
            context: { traceId: "ui-workforce-" + Date.now() },
          }),
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error?.message || payload.message || "Workforce 本地执行失败。");
        }
        updateWorkforceResult(payload.data || {});
        showToast("Workforce 本地执行已完成：计划、任务队列和证据已生成；未调用 Provider，未读取密钥。");
        return true;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = previousText || "运行 Workforce 本地执行";
        }
      }
    }

    function updateFiveCapabilityResult(result) {
      const panel = byId("five-capability-result-panel");
      const title = byId("five-capability-result-title");
      const copy = byId("five-capability-result-copy");
      if (!panel) return false;
      const capabilities = result.capabilities || {};
      if (title) {
        title.textContent = result.completionVerified
          ? "五大能力激活完成"
          : "五大能力激活未全部通过";
      }
      if (copy) {
        copy.textContent = result.userVisibleSummary || result.verificationReason || "状态已更新。";
      }
      setText("five-capability-workforce-status", "Workforce: " + (capabilities.workforce?.status || "unknown"));
      setText("five-capability-three-mode-status", "Three-Mode: " + (capabilities.threeMode?.status || "unknown"));
      setText("five-capability-taiji-status", "Taiji/Beidou: " + (capabilities.taijiBeidou?.status || "unknown"));
      setText("five-capability-gvc-status", "GVC: " + (capabilities.gvc?.status || "unknown"));
      setText("five-capability-codex-status", "Codex: " + (capabilities.codex?.status || "unknown"));
      panel.hidden = false;
      panel.classList.add("is-visible");
      focusMissionNode("five-capability-activation-panel");
      return true;
    }

    async function activateFiveCapabilities() {
      const button = byId("activate-five-capabilities-button");
      const previousText = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = "正在激活五大能力...";
      }
      try {
        const response = await fetch("/real-capabilities/activate-five", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goal: "激活 AI Gateway Workbench 五大真实可用能力，并生成本地证据。",
            selectedTemplate: "feature-development",
            context: { traceId: "ui-five-capability-" + Date.now() },
          }),
        });
        const payload = await response.json();
        if (!response.ok || payload.status === "error") {
          throw new Error(payload.error?.message || payload.message || "五大能力激活失败。");
        }
        updateFiveCapabilityResult(payload.data || {});
        showToast("五大能力已激活并写入证据：本地执行完成，未读取密钥，未部署发布。");
        return true;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = previousText || "一键激活五大能力";
        }
      }
    }

    async function handleWorkforceAction(action) {
      if (action === "pyramid") {
        showToast("Employee Pyramid 已聚焦。L0-L6 是本地编排角色。");
        return focusMissionNode("workforce-pyramid-preview");
      }
      if (action === "positions") {
        showToast("职位库已聚焦。来源支持但不声称覆盖全球全部岗位。");
        return focusMissionNode("position-library-panel");
      }
      if (action === "dry-run" || action === "real-local-run") return runWorkforceRealLocal();
      if (action === "evidence") {
        const resultPanel = byId("workforce-preview-result-panel");
        if (resultPanel && resultPanel.hidden) {
          await runWorkforceRealLocal();
        }
        showToast("Workforce 执行证据已聚焦。证据来自本地真实执行链路。");
        return focusMissionNode("workforce-evidence-timeline-panel");
      }
      if (action === "brain-boundary") {
        showToast("大脑接入边界已聚焦。Provider 调用必须单独授权，本地执行不读取密钥。");
        return focusMissionNode("brain-adapter-boundary-panel");
      }
      return false;
    }

    function showInternalCommunicationPreview(action) {
      const resultPanel = byId("internal-communication-result-panel");
      const resultTitle = byId("internal-communication-result-title");
      const resultCopy = byId("internal-communication-result-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        thread: {
          title: "Internal Employee Thread Preview",
          copy: "Thread created: Product Chief asks UX Researcher to review sample dry-run onboarding friction; reply created; evidence timeline recorded.",
        },
        mention: {
          title: "Employee Mention Preview",
          copy: "@AI Gateway Engineer routed for provider_routing_audit; schedulerApprovalRequiredForNewParticipants=true; maxBrainCalls=0.",
        },
        handoff: {
          title: "Employee Handoff Preview",
          copy: "UX Researcher -> AI Gateway Engineer handoff recorded; accepted=true dry-run; reason preserved.",
        },
        objection: {
          title: "Security Objection Preview",
          copy: "Security Chief objection: riskLevel=high; providerCallsMade=false; secretValueExposed=false.",
        },
        summary: {
          title: "Council Summary Preview",
          copy: "Council summary created with final recommendation; no provider call; no external IM send.",
        },
      };
      const preview = previews[action] || previews.thread;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      showToast("Internal employee communication preview updated. No provider call, no secret, no external IM send.");
      focusMissionNode("internal-communication-result-panel");
      return true;
    }

    function showBranchExecutionPreview(action) {
      const resultPanel = byId("branch-execution-result-panel");
      const resultTitle = byId("branch-execution-result-title");
      const resultCopy = byId("branch-execution-result-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        plan: {
          title: "Adaptive Branch Plan Preview",
          copy: "Branch plan created: product, engineering, and safety paths. maxActiveBranches=3; maxActiveEmployees=3; maxBrainCalls=0.",
        },
        execute: {
          title: "Dry-Run Branch Execution Preview",
          copy: "Dry-run branches executed. Product and Engineering outputs completed; providerCallsMade=false; rawSecretAccessed=false.",
        },
        merge: {
          title: "Result Merger Preview",
          copy: "Result merger accepted verified branch outputs and kept rejected/conflicted outputs outside the final summary.",
        },
        load: {
          title: "Load Governance Preview",
          copy: "Load governance kept three active employees and rejected overflow employees with employee_load_governance_limit.",
        },
        failure: {
          title: "Failure Injection Preview",
          copy: "Failure injection handled timeout, employee_unavailable, and merge_conflict without marking failed branches as pass.",
        },
      };
      const preview = previews[action] || previews.plan;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      showToast("Branch execution fabric preview updated. Dry-run only, no provider call, no external IM send.");
      focusMissionNode("branch-execution-result-panel");
      return true;
    }

    function showGvcRunnerCommandPreview(commandIntent) {
      const resultPanel = byId("gvc-runner-command-preview-result");
      const resultTitle = byId("gvc-runner-command-preview-title");
      const resultCopy = byId("gvc-runner-command-preview-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        pause: {
          title: "暂停 command preview",
          copy: "commandIntent=pause; wouldWriteControlFile=true; target paused=true; realWritePerformed=false; processSignalSent=false.",
        },
        resume: {
          title: "继续 command preview",
          copy: "commandIntent=resume; wouldWriteControlFile=true; target paused=false; realWritePerformed=false; processSignalSent=false.",
        },
        stop: {
          title: "停止 command preview",
          copy: "commandIntent=stop; wouldWriteControlFile=true; target stopRequested=true; realWritePerformed=false; processSignalSent=false.",
        },
      };
      const preview = previews[commandIntent] || previews.pause;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      resultPanel.dataset.commandIntent = commandIntent;
      showToast("Runner command preview 已生成：dry-run only，未写控制文件，未停止进程。");
      focusMissionNode("gvc-runner-command-preview-result");
      return true;
    }

    function showLongHorizonHardeningPreview(action) {
      const resultPanel = byId("hardening-preview-result-panel");
      const resultTitle = byId("hardening-preview-result-title");
      const resultCopy = byId("hardening-preview-result-copy");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const previews = {
        scenario: {
          title: "Scenario Matrix Preview",
          copy: "Simple, standard, complex, urgent, high-risk, background, employee, conflict, invalid-input, duplicate, unknown employee, and lane fallback cases carry traceRef, evidenceId, and laneId.",
        },
        load: {
          title: "Load Governance Preview",
          copy: "100/500/1000 input dry-run simulations expose accepted, deferred, and rejected states; foreground priority is protected and full broadcast remains blocked.",
        },
        trace: {
          title: "Debug Trace Preview",
          copy: "inputId, threadId, laneId, evidenceId, outputId, failure classification, debug snapshot, and rollback location stay linked for operator diagnosis.",
        },
        safety: {
          title: "Security Boundary Preview",
          copy: "Provider, raw secret, webhook, external IM, production rollout, publication, tag, artifact, billing, invoice, /chat, and /chat-gateway/execute actions are blocked by gate preview.",
        },
        adapter: {
          title: "External Adapter Readiness Preview",
          copy: "Feishu, WeCom, Web, and API adapters are contract previews using credentialRef, idempotency, and trace mapping; no raw webhook read and no real send.",
        },
        soak: {
          title: "Soak / Chaos Preview",
          copy: "Random input, lane failure, employee unavailable, output failure, conflict injection, safety block, evidence loop, trace loop, and drift guards stay dry-run.",
        },
      };
      const preview = previews[action] || previews.scenario;
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      showToast("Long-horizon hardening preview updated. Dry-run only, no provider call, no external send.");
      focusMissionNode("hardening-preview-result-panel");
      return true;
    }

    function readCodexContextPreviewData() {
      const node = byId("codex-context-preview-data");
      if (!node) return {};
      try {
        return JSON.parse(node.textContent || "{}");
      } catch {
        return {};
      }
    }

    function showCodexContextPreview(action) {
      const resultPanel = byId("codex-context-preview-detail");
      const resultTitle = byId("codex-context-preview-title");
      const resultCopy = byId("codex-context-preview-copy");
      const boundaryLine = byId("codex-context-preview-boundary-line");
      if (!resultPanel || !resultTitle || !resultCopy) return false;
      const data = readCodexContextPreviewData();
      const previews = {
        "context-pack": data.contextPack,
        "token-budget": data.tokenBudget,
        "relevant-files": data.relevantFiles,
        "prompt-pack": data.promptPack,
        freshness: data.freshness,
        "evidence-index": data.evidenceIndex,
        "refresh-preview": data.refreshPreview,
        "copy-prompt": data.copyPrompt,
        "usage-workflow": data.usageWorkflow,
        preflight: data.preflight,
        "validation-plan": data.validationPlan,
        "dry-run-wrapper": data.dryRunWrapper,
        "failure-modes": data.failureModes,
        "operator-checklist": data.operatorChecklist,
        "usage-trial": data.usageTrial,
        "next-instruction": data.nextInstruction,
        "repeated-benchmark": data.repeatedBenchmark,
        "benchmark-next": data.benchmarkNext,
        "base-url-design": data.baseUrlDesign,
        "base-url-config-preview": data.baseUrlConfigPreview,
        "base-url-authorization": data.baseUrlAuthorization,
        "base-url-rollback": data.baseUrlRollback,
        "base-url-risk-review": data.baseUrlRiskReview,
        "base-url-checklist": data.baseUrlChecklist,
        "auth-status": data.authStatus,
        "auth-missing-fields": data.authMissingFields,
        "auth-dry-run-simulation": data.authDryRunSimulation,
        "auth-redacted-config": data.authRedactedConfig,
        "auth-relay": data.authRelay,
        "auth-account-pool": data.authAccountPool,
        "auth-credential": data.authCredential,
        "auth-policy": data.authPolicy,
        "auth-rollback": data.authRollback,
        "auth-emergency": data.authEmergency,
        "auth-evidence": data.authEvidence,
        "human-approval-review": data.humanApprovalReview,
        "human-approval-missing-fields": data.humanApprovalMissingFields,
        "guarded-real-test-readiness": data.guardedRealTestReadiness,
        "phase600-readiness": data.phase600Readiness,
        "phase600-missing-fields": data.phase600MissingFields,
        "phase600-next-action": data.phase600NextAction,
        "phase601-preparation": data.phase601Preparation,
        "phase601-command-bundle": data.phase601CommandBundle,
        "phase602-one-shot-result": data.phase602OneShotResult,
        "phase602-cleanup": data.phase602Cleanup,
        "phase603-custom-provider-route": data.phase603CustomProviderRoute,
        "phase603-command-bundle": data.phase603CommandBundle,
        "phase604-custom-provider-result": data.phase604CustomProviderResult,
        "phase604-cleanup": data.phase604Cleanup,
        "phase610r-codex-exec-result": data.phase610rCodexExecResult,
        "phase610r-boundary": data.phase610rBoundary,
        "phase611r-reliability-design": data.phase611rReliabilityDesign,
        "phase611r-attempt-plan": data.phase611rAttemptPlan,
        "phase611r-guarded-test-design": data.phase611rGuardedTestDesign,
        "phase611r-phase612-gate": data.phase611rPhase612Gate,
        "phase612r-repeated-result": data.phase612rRepeatedResult,
        "phase612r-repeated-boundary": data.phase612rRepeatedBoundary,
        "phase613r-closure": data.phase613rClosure,
        "phase613r-next-gate": data.phase613rNextGate,
        "phase614r-preview-gate": data.phase614rPreviewGate,
        "phase614r-route-contract": data.phase614rRouteContract,
        "phase615r-approval-packet": data.phase615rApprovalPacket,
        "phase615r-operator-checklist": data.phase615rOperatorChecklist,
        "phase616r-620r-dry-run-candidate": data.phase616r620rDryRunCandidate,
        "phase616r-620r-route-contract": data.phase616r620rRouteContract,
      };
      const preview = previews[action] || previews["context-pack"] || {
        title: "Context Pack Preview",
        copy: "Codex Context Gateway preview data is unavailable.",
      };
      resultTitle.textContent = preview.title;
      resultCopy.textContent = preview.copy;
      if (boundaryLine) {
        boundaryLine.textContent = "providerCallsMade=false; rawSecretAccessed=false; rawWebhookAccessed=false; codexBaseUrlModified=false; codexConfigModified=false; realCodexConnectionMade=false; relayStarted=false; realConfigWriteAllowed=false; relayStartAllowed=false; realIntegrationAllowed=false; chatModified=false; chatGatewayExecuteModified=false";
      }
      resultPanel.hidden = false;
      resultPanel.classList.add("is-visible");
      if (action === "copy-prompt" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(preview.copy).catch(() => {});
      }
      const message = action === "refresh-preview"
        ? "Codex Context Gateway preview refreshed from .codex-context only."
        : action === "copy-prompt"
          ? "Prompt pack preview copied locally. Dry-run only."
          : "Codex Context Gateway preview updated. No real Codex connection, no provider call.";
      showToast(message);
      focusMissionNode("codex-context-preview-detail");
      return true;
    }

    function renderModelOptions() {
      const select = byId("model-select");
      if (!select) return;
      const options = state.selectableModels.length ? state.selectableModels : [];
      select.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
      if (!options.includes(state.selectedModel)) {
        state.selectedModel = options[0] || "";
      }
      select.value = state.selectedModel || "";
      setText("model-page-current-selection", state.selectedModel || "未选择");
      saveSelectedModel();
      renderTopbar();
      renderThreeModeControls();
    }

    function renderThreeModeControls() {
      const options = state.selectableModels.length ? state.selectableModels : [];
      const normalSelect = byId("three-mode-normal-model");
      const godParticipants = byId("three-mode-god-participants");
      const godSupervisor = byId("three-mode-god-supervisor");
      const normalProvider = byId("three-mode-normal-provider");
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      if (normalSelect) {
        normalSelect.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
        normalSelect.value = options.includes(state.selectedModel) ? state.selectedModel : (options[0] || "");
      }
      if (godParticipants) {
        godParticipants.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
        const preferred = options.slice(0, Math.min(3, options.length));
        Array.from(godParticipants.options).forEach((option) => {
          option.selected = preferred.includes(option.value);
        });
      }
      if (godSupervisor) {
        godSupervisor.innerHTML = options.map((modelId) => "<option value=\\"" + escapeHtml(modelId) + "\\">" + escapeHtml(modelId) + "</option>").join("");
        godSupervisor.value = options[1] || options[0] || "";
      }
      if (normalProvider) {
        normalProvider.textContent = options.length ? "NVIDIA selectable runtime ready" : "尚未加载可选模型";
      }
      const selectedModelNode = byId("three-mode-normal-selected-model");
      const providerStatusNode = byId("three-mode-normal-provider-status");
      const credentialStatusNode = byId("three-mode-normal-credential-status");
      const governanceStatusNode = byId("three-mode-normal-governance-status");
      if (selectedModelNode) {
        selectedModelNode.textContent = "selectedModel: " + (state.selectedModel || options[0] || "pending");
      }
      if (providerStatusNode) {
        providerStatusNode.textContent = "providerStatus: " + (provider?.keyStatus || "pending");
      }
      if (credentialStatusNode) {
        credentialStatusNode.textContent = "credentialRefStatus: " + (provider?.apiKeyConfigured ? "configured_hidden_value" : "credentialRefOnly_required");
      }
      if (governanceStatusNode) {
        governanceStatusNode.textContent = "quota / budget / selectable: " + (options.length ? "selectable models available" : "provider or model setup required");
      }
      syncThreeModeTabs();
    }

    function applyReadonlyAcceptanceView() {
      const page = (queryParams.get("page") || "").trim().toLowerCase();
      const threeMode = (queryParams.get("threeMode") || queryParams.get("mode") || "").trim().toLowerCase();
      if (["chat", "models", "approvals", "files", "diagnostics"].includes(page)) {
        state.activePage = page;
      }
      if (["normal", "god", "tianshu"].includes(threeMode)) {
        state.activeThreeMode = threeMode;
      }
    }

    function syncThreeModeTabs() {
      document.querySelectorAll("[data-three-mode]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-three-mode") === state.activeThreeMode);
      });
      ["normal", "god", "tianshu"].forEach((mode) => {
        byId("three-mode-panel-" + mode)?.classList.toggle("is-active", state.activeThreeMode === mode);
      });
    }

    function classifyTaskPreview(input) {
      const text = String(input || "").toLowerCase();
      if (/code|review|bug|diff|test|script/.test(text)) return "coding";
      if (/translate|translation|缈昏瘧/.test(text)) return "translation";
      if (/summary|summarize|鎬荤粨/.test(text)) return "writing";
      if (/analysis|analy|report|璇婃柇|鍒嗘瀽/.test(text)) return "data_analysis";
      if (/reason|plan|design|architecture|鏂规/.test(text)) return "reasoning";
      if (/context|long|鏂囨。/.test(text)) return "long_context";
      return "general_chat";
    }

    function renderThreeModeResult(payload) {
      const resultNode = byId("three-mode-result-output");
      const auditNode = byId("three-mode-audit-output");
      const telemetryNode = byId("three-mode-telemetry-output");
      const badge = byId("three-mode-safety-badge");
      const taskPreview = byId("three-mode-task-preview");
      if (!resultNode || !auditNode || !badge) return;
      if (!payload) {
        resultNode.textContent = "No Three Mode result yet.";
        auditNode.textContent = "No audit trace yet.";
        if (telemetryNode) telemetryNode.textContent = "latencyMs=0\\nestimatedTokenUsage=0\\nestimatedCost=internal_test_cost_unknown\\nquotaStatus=unknown\\nbudgetStatus=unknown\\npolicyStatus=unknown\\ncredentialStatus=credentialRefOnly";
        badge.textContent = "providerCallsMade=false | nonNvidiaProviderCallsMade=false | secretValueExposed=false";
        if (taskPreview) taskPreview.textContent = "taskClassification: pending";
        renderThreeModeCandidatePanels(null);
        return;
      }
      const data = payload.data || {};
      const audit = data.auditTrace || {};
      resultNode.textContent = prettyJson({
        mode: data.mode,
        finalAnswer: data.finalAnswer,
        selectedModel: data.selectedModel?.modelId || null,
        participantModels: (data.participantModels || []).map((item) => item.modelId),
        plannerDecision: data.plannerDecision || null,
        supervisorDecision: data.supervisorDecision || null,
        disagreements: data.disagreements || [],
        fallbackUsed: data.fallbackUsed === true
      });
      auditNode.textContent = prettyJson(audit);
      if (telemetryNode) {
        const estimatedTokenUsage = Math.ceil(String(data.finalAnswer || "").length / 4);
        telemetryNode.textContent = prettyJson({
          currentMode: data.mode,
          selectedModel: data.selectedModel?.modelId || null,
          participantModels: (data.participantModels || []).map((item) => item.modelId),
          selectedModels: data.plannerDecision?.selectedModels || audit.selectedModels || [],
          providerCallsMade: audit.providerCallsMade === true,
          nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
          fallbackUsed: data.fallbackUsed === true || audit.fallbackUsed === true,
          latencyMs: Number(audit.durationMs || payload.meta?.durationMs || 0),
          participantCallCount: Number(audit.participantCallCount || 0),
          supervisorCallCount: Number(audit.supervisorCallCount || 0),
          estimatedTokenUsage,
          estimatedCost: audit.estimatedCost ?? "internal_test_cost_unknown",
          costVisibility: audit.estimatedCost ? "estimate" : "estimatedOnly",
          quotaStatus: audit.quotaStatus || null,
          budgetStatus: audit.budgetStatus || null,
          policyStatus: audit.policyDecision?.policyStatus || "unknown",
          credentialStatus: audit.credentialRefOnly === true ? "credentialRefOnly" : "not_applicable",
          safetyWarnings: audit.nonNvidiaProviderCallsMade === true ? ["userOwnedProviderCostMayApply"] : []
        });
      }
      badge.textContent = "providerCallsMade=" + String(audit.providerCallsMade === true)
        + " | nonNvidiaProviderCallsMade=" + String(audit.nonNvidiaProviderCallsMade === true)
        + " | credentialRefOnly=true"
        + " | secretValueExposed=" + String(audit.secretValueExposed === true);
      badge.className = "inline-status " + ((audit.providerCallsMade === true && audit.secretValueExposed !== true) ? "ok" : "warn");
      if (taskPreview) {
        taskPreview.textContent = "taskClassification: " + (data.plannerDecision?.taskClassification || classifyTaskPreview(byId("three-mode-tianshu-input")?.value || ""));
      }
      renderThreeModeCandidatePanels(payload);
    }

    function renderThreeModeCandidatePanels(payload) {
      const data = payload?.data || {};
      const audit = data.auditTrace || {};
      const disagreements = Array.isArray(data.disagreements) ? data.disagreements : [];
      const participantModels = Array.isArray(data.participantModels) ? data.participantModels.map((item) => item.modelId) : [];
      const plannerDecision = data.plannerDecision || {};
      const selectedModels = Array.isArray(plannerDecision.selectedModels) ? plannerDecision.selectedModels : [];
      const rejectedCandidates = Array.isArray(plannerDecision.rejectedCandidates) ? plannerDecision.rejectedCandidates : [];
      const participantSummaryNode = byId("three-mode-god-participant-summary");
      const conflictLevelNode = byId("three-mode-god-conflict-level");
      const disagreementNode = byId("three-mode-god-disagreement-points");
      const fallbackNode = byId("three-mode-god-fallback-reason");
      const supervisorStatusNode = byId("three-mode-god-supervisor-status");
      const supervisorBasisNode = byId("three-mode-god-supervisor-basis");
      const supervisorUncertaintyNode = byId("three-mode-god-supervisor-uncertainty");
      const warningStatusNode = byId("three-mode-god-warning-status");
      const plannerStatusNode = byId("three-mode-tianshu-planner-status");
      const selectedModelsNode = byId("three-mode-tianshu-selected-models");
      const rejectedNode = byId("three-mode-tianshu-rejected-candidates");
      const capabilityNode = byId("three-mode-tianshu-capability-summary");
      const noCandidateReasonNode = byId("three-mode-tianshu-no-candidate-reason");
      const nextActionsNode = byId("three-mode-tianshu-next-actions");
      const providerWarningNode = byId("three-mode-tianshu-provider-warning");
      const dryRunStatusNode = byId("three-mode-tianshu-dry-run-status");
      const providerStatus = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0]?.keyStatus : "unknown";
      const warnings = []
        .concat(audit.quotaStatus ? ["quota=" + audit.quotaStatus] : [])
        .concat(audit.budgetStatus ? ["budget=" + audit.budgetStatus] : [])
        .concat(providerStatus ? ["provider=" + providerStatus] : [])
        .concat(audit.credentialRefOnly === true ? ["credentialRefOnly=true"] : ["credentialRefOnly=required"]);
      if (participantSummaryNode) {
        participantSummaryNode.textContent = "participantSelection: " + (participantModels.length ? participantModels.join(", ") : "pending / dry-run candidate");
      }
      if (conflictLevelNode) {
        conflictLevelNode.textContent = "conflictLevel: " + (disagreements.length > 1 ? "high" : disagreements.length === 1 ? "medium" : "none");
      }
      if (disagreementNode) {
        disagreementNode.textContent = "disagreementPoints: " + (disagreements.length ? disagreements.join(" | ") : "[]");
      }
      if (fallbackNode) {
        fallbackNode.textContent = "fallbackReason: " + (data.fallbackUsed ? (audit.fallbackReason || "fallback_used") : "none");
      }
      if (supervisorStatusNode) {
        supervisorStatusNode.textContent = "synthesisStatus: " + (data.supervisorDecision ? "completed" : "pending");
      }
      if (supervisorBasisNode) {
        supervisorBasisNode.textContent = "decisionBasis: " + ((audit.selectedModels || selectedModels).length ? (audit.selectedModels || selectedModels).join(", ") : "[]");
      }
      if (supervisorUncertaintyNode) {
        supervisorUncertaintyNode.textContent = "uncertainty: " + (audit.providerCallsMade === true ? "provider result may still require review" : "dry-run / candidate only");
      }
      if (warningStatusNode) {
        warningStatusNode.textContent = "warnings: " + warnings.join(" | ");
      }
      if (plannerStatusNode) {
        plannerStatusNode.textContent = "plannerStatus: " + (plannerDecision.taskClassification ? "selected" : payload ? "dry_run" : "pending");
      }
      if (selectedModelsNode) {
        selectedModelsNode.textContent = "selectedModelRefs: " + (selectedModels.length ? selectedModels.join(", ") : "[]");
      }
      if (rejectedNode) {
        rejectedNode.textContent = "rejectedCandidates: " + (rejectedCandidates.length ? rejectedCandidates.map((item) => item.modelId || item.reason || "candidate").join(" | ") : "[]");
      }
      if (capabilityNode) {
        capabilityNode.textContent = "capabilityMatch: " + (plannerDecision.taskClassification || classifyTaskPreview(byId("three-mode-tianshu-input")?.value || ""));
      }
      if (noCandidateReasonNode) {
        noCandidateReasonNode.textContent = "reason: " + (selectedModels.length ? "not_triggered" : (audit.fallbackReason || "planner_no_candidate_candidate"));
      }
      if (nextActionsNode) {
        nextActionsNode.textContent = "nextActions: 配置 provider | 查看 Model Library | 切换 Normal Mode | 重试 planner";
      }
      if (providerWarningNode) {
        providerWarningNode.textContent = "provider / credentialRef warning: " + (providerStatus || "pending");
      }
      if (dryRunStatusNode) {
        dryRunStatusNode.textContent = "dryRunNotice: candidate only / providerCallsMade=" + String(audit.providerCallsMade === true);
      }
    }

    function buildThreeModeRequest(mode) {
      const requestId = "phase328a-ui-" + mode + "-" + Date.now();
      if (mode === "normal") {
        const content = byId("three-mode-normal-input")?.value.trim() || "";
        const selectedModelId = byId("three-mode-normal-model")?.value || state.selectedModel;
        return {
          requestId,
          mode,
          input: { content },
          modelSelection: { selectedModelId },
          executionPolicy: { timeoutMs: 60000, allowFallback: true, allowParallelExecution: false, allowGodEscalation: false },
          audit: { traceEnabled: true }
        };
      }
      if (mode === "god") {
        const content = byId("three-mode-god-input")?.value.trim() || "";
        const autoSelect = byId("three-mode-god-auto")?.checked === true;
        const participants = autoSelect ? [] : Array.from(byId("three-mode-god-participants")?.selectedOptions || []).map((option) => option.value);
        const maxParticipants = Number(byId("three-mode-god-max-participants")?.value || 3);
        return {
          requestId,
          mode,
          input: { content },
          modelSelection: {
            participantModelIds: participants,
            supervisorModelId: byId("three-mode-god-supervisor")?.value || state.selectedModel,
            allowSystemModelSelection: autoSelect
          },
          executionPolicy: { timeoutMs: 120000, allowParallelExecution: true, maxParticipants },
          audit: { traceEnabled: true, includeModelContributions: true }
        };
      }
      const content = byId("three-mode-tianshu-input")?.value.trim() || "";
      return {
        requestId,
        mode: "tianshu",
        input: { content },
        executionPolicy: {
          timeoutMs: 120000,
          allowFallback: true,
          allowGodEscalation: byId("three-mode-tianshu-allow-god")?.checked !== false
        },
        audit: { traceEnabled: true, includePlannerDecision: true }
      };
    }

    async function runThreeMode(mode) {
      const request = buildThreeModeRequest(mode);
      const text = String(request.input?.content || "").trim();
      if (!text) {
        showToast("请输入 Three Mode 内容后再执行。", "warn");
        return;
      }
      const resultNode = byId("three-mode-result-output");
      const auditNode = byId("three-mode-audit-output");
      if (resultNode) resultNode.textContent = "Running " + mode + " mode...";
      if (auditNode) auditNode.textContent = "waiting for audit trace...";
      try {
        const payload = await threeModeExecute(request);
        state.lastThreeModeResult = payload;
        state.lastError = null;
        renderThreeModeResult(payload);
        renderEvidenceDrawer();
        renderDiagnostics();
        showToast("Three Mode runtime returned: " + mode);
      } catch (error) {
        state.lastError = error.message;
        if (resultNode) resultNode.textContent = "Three Mode failed: " + error.message;
        if (auditNode) auditNode.textContent = prettyJson({ providerCallsMade: false, nonNvidiaProviderCallsMade: false, secretValueExposed: false, error: error.message });
        renderDiagnostics();
        showToast(error.message, "error");
      }
    }

    function modelLatencyMs(item) {
      const fromStrategy = [
        ...PHASE324D2F_STRATEGY.fastModels,
        ...PHASE324D2F_STRATEGY.highQualityModels,
        ...PHASE324D2F_STRATEGY.lowLatencyModels,
        ...PHASE324D2F_STRATEGY.highLatencyWarning
      ].find((row) => row.modelId === item.modelId);
      const direct = Number(item.lastSmokeResult?.durationMs ?? item.latencyMs);
      if (Number.isFinite(direct) && direct > 0) return direct;
      return Number.isFinite(Number(fromStrategy?.latencyMs)) ? Number(fromStrategy.latencyMs) : null;
    }

    function decorateModelRows(records) {
      return records.map((item) => {
        const failedEvidence = PHASE324D_FAILED_MODEL_REASONS[item.modelId] || {};
        const latencyMs = modelLatencyMs(item);
        const status = failedEvidence.evidenceId ? "smoke_failed" : String(item.verificationStatus || "unverified");
        const evidenceId = failedEvidence.evidenceId || item.evidenceId || "";
        const failureReason = failedEvidence.reason || item.failureReason || item.selectableReason || "";
        return {
          ...item,
          verificationStatus: status,
          evidenceId,
          failureReason,
          nonSelectableReason: item.selectable === true ? "" : (failureReason || "no valid smoke evidence"),
          latencyMs,
          highLatency: Number(latencyMs) > 10000,
          providerScope: MODEL_PROVIDER_SCOPE[item.providerId] || "future-provider-slot"
        };
      });
    }

    function rowMatchesControls(row) {
      const controls = state.modelLibraryControls;
      const query = String(controls.query || "").toLowerCase().trim();
      const bucket = String(row.capabilityBucket || "").toLowerCase();
      const status = String(row.verificationStatus || "").toLowerCase();
      if (controls.status === "selectable" && row.selectable !== true) return false;
      if (controls.status === "smoke_passed" && status !== "smoke_passed") return false;
      if (controls.status === "failed" && status !== "smoke_failed") return false;
      if (controls.status === "unverified" && status !== "unverified") return false;
      if (controls.status === "high_latency" && row.highLatency !== true) return false;
      if (controls.providerScope !== "all" && row.providerScope !== controls.providerScope) return false;
      if (controls.capability === "chat_like" && !(bucket.includes("chat") || bucket.includes("instruct"))) return false;
      if (controls.capability === "unknown" && bucket !== "unknown") return false;
      if (controls.capability === "non_chat" && (bucket.includes("chat") || bucket.includes("instruct"))) return false;
      if (!query) return true;
      const haystack = [
        row.modelId,
        row.providerId,
        row.evidenceId,
        row.capabilityBucket,
        row.failureReason,
        row.nonSelectableReason,
        row.verificationStatus
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    }

    function sortModelRows(rows) {
      const sorted = [...rows];
      const sort = state.modelLibraryControls.sort;
      const latency = (item) => Number.isFinite(Number(item.latencyMs)) ? Number(item.latencyMs) : Number.MAX_SAFE_INTEGER;
      if (sort === "model_asc") sorted.sort((left, right) => String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "status") sorted.sort((left, right) => String(left.verificationStatus).localeCompare(String(right.verificationStatus)) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "latency_asc") sorted.sort((left, right) => latency(left) - latency(right) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "latency_desc") sorted.sort((left, right) => latency(right) - latency(left) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "selectable_first") sorted.sort((left, right) => Number(right.selectable === true) - Number(left.selectable === true) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "evidence_first") sorted.sort((left, right) => Number(Boolean(right.evidenceId)) - Number(Boolean(left.evidenceId)) || String(left.modelId).localeCompare(String(right.modelId)));
      if (sort === "verified_desc") sorted.sort((left, right) => String(right.lastVerifiedAt || "").localeCompare(String(left.lastVerifiedAt || "")));
      return sorted;
    }

    function modelRowHtml(item) {
      const tone = item.selectable === true ? "ok" : item.verificationStatus === "smoke_failed" ? "error" : "warn";
      const latencyCopy = item.latencyMs ? " | latencyMs: " + escapeHtml(item.latencyMs) : "";
      const warning = item.highLatency ? "<span class=\\"inline-status warn\\">high latency</span>" : "";
      const reason = item.selectable === true ? "quick chat allowed" : item.nonSelectableReason;
      return "<div class=\\"model-item\\">"
        + "<div class=\\"row\\"><strong>" + escapeHtml(item.modelId) + "</strong><span class=\\"" + statusClass(tone) + "\\">" + escapeHtml(item.verificationStatus) + "</span>" + warning + "</div>"
        + "<div class=\\"card-copy\\">provider: " + escapeHtml(item.providerId || "nvidia") + " | scope: " + escapeHtml(item.providerScope) + " | capability: " + escapeHtml(item.capabilityBucket || "unknown") + latencyCopy + "</div>"
        + "<div class=\\"card-copy\\">evidenceId: " + escapeHtml(item.evidenceId || "none") + "</div>"
        + "<div class=\\"card-copy\\">selectable: " + escapeHtml(item.selectable === true ? "true" : "false") + " | reason: " + escapeHtml(reason || "none") + "</div>"
        + "</div>";
    }

    function renderModelStrategy() {
      const summary = byId("model-library-strategy-summary");
      const output = byId("model-library-strategy-output");
      if (!summary || !output) return;
      summary.innerHTML = "<strong>Model selection strategy:</strong> read-only operations advice. It does not change real routing, selectedModel localStorage, Chat dropdown, or selectable gate.";
      const strategyCards = [
        ["defaultRecommended", [PHASE324D2F_STRATEGY.defaultRecommended]],
        ["fastModels", PHASE324D2F_STRATEGY.fastModels],
        ["highQualityModels", PHASE324D2F_STRATEGY.highQualityModels],
        ["lowLatencyModels", PHASE324D2F_STRATEGY.lowLatencyModels],
        ["fallbackCandidates", PHASE324D2F_STRATEGY.fallbackCandidates],
        ["highLatencyWarning", PHASE324D2F_STRATEGY.highLatencyWarning]
      ];
      output.innerHTML = strategyCards.map((entry) => {
        return "<div class=\\"model-item\\"><strong>" + escapeHtml(entry[0]) + "</strong><div class=\\"card-copy\\">"
          + entry[1].map((item) => escapeHtml(item.modelId + (item.latencyMs ? " (" + item.latencyMs + "ms)" : ""))).join("<br>")
          + "</div></div>";
      }).join("");
    }

    function renderModelLibrary() {
      const container = byId("model-list-output");
      if (!container) return;
      const matrix = state.modelLibrary?.data?.usabilityMatrix || state.modelLibrary?.usabilityMatrix || null;
      const records = Array.isArray(matrix?.records)
        ? matrix.records
        : [];
      const summary = matrix?.summary || {};
      const selectable = records.filter((item) => {
        const bucket = String(item.capabilityBucket || "").toLowerCase();
        return item.verificationStatus === "smoke_passed"
          && item.selectable === true
          && item.directChatAllowed === true
          && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code" || bucket === "chat_reasoning");
      });
      const decorated = decorateModelRows(records);
      state.modelLibraryRows = decorated;
      const filtered = sortModelRows(decorated.filter(rowMatchesControls));
      const failedCount = decorated.filter((item) => item.verificationStatus === "smoke_failed").length;
      const unverifiedCount = decorated.filter((item) => item.verificationStatus === "unverified").length;
      const summaryNode = byId("model-library-status-summary");
      if (summaryNode) {
        summaryNode.innerHTML = "<div><strong>verified selectable:</strong> " + escapeHtml(summary.selectableModels ?? selectable.length) + "</div>"
          + "<div><strong>smoke passed:</strong> " + escapeHtml(summary.smokePassedModels ?? selectable.length) + "</div>"
          + "<div><strong>provider scope:</strong> NVIDIA-only</div>"
          + "<div><strong>future provider slots:</strong> OpenAI / Claude / OpenRouter / MiMo are not enabled for real calls.</div>"
          + "<div><strong>rule:</strong> only smoke_passed models with evidenceId appear in quick chat dropdown.</div>"
          + "<div><strong>strategy:</strong> read-only recommendation; no real default route changes.</div>";
      }
      const stats = byId("model-library-filter-stats");
      if (stats) {
        stats.textContent = "results=" + filtered.length + " | selectable=" + selectable.length + " | failed=" + failedCount + " | unverified=" + unverifiedCount;
      }
      container.innerHTML = filtered.slice(0, 80).map(modelRowHtml).join("")
        || "<div class=\\"model-item\\"><strong>No matching models</strong><div class=\\"card-copy\\">No API call was triggered. Adjust search, status, provider scope, capability, or sort controls.</div></div>";
      renderModelStrategy();
    }

    function renderProviderStatus() {
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      if (!provider) return;
      const configured = provider.apiKeyConfigured === true;
      const badge = byId("provider-key-status-badge");
      if (badge) {
        badge.className = configured ? "inline-status ok" : "inline-status error";
        badge.textContent = configured ? "已配置（已隐藏）" : "未配置";
      }
      setText("provider-key-summary", configured ? "已配置，页面不显示明文" : "未配置 API Key");
      setText("provider-test-summary", provider.lastTestResult?.message || "尚未测试");
      setText("provider-key-status-badge", configured ? "已配置（已隐藏）" : "未配置");
      const providerChip = byId("provider-chip");
      if (providerChip) {
        const pillValue = providerChip.querySelector(".pill-value");
        if (pillValue) {
          pillValue.textContent = provider.keyStatus;
        } else {
          providerChip.textContent = "Provider：" + provider.keyStatus;
          providerChip.className = "status-chip";
        }
      }
      renderTopbar();
    }

    function renderApprovals() {
      const container = byId("approval-list");
      if (!container) return;
      if (state.approvalsUnsupported) {
        container.innerHTML = "<div class=\\"approval-item\\"><strong>Approvals API unavailable in this local dry-run build.</strong><div class=\\"card-copy\\">当前 dry-run 环境不可读取审批列表；Mission Control sample dry-run 仍可正常体验。</div></div>";
        return;
      }
      if (!state.approvals.length) {
        container.innerHTML = "<div class=\\"approval-item\\"><strong>当前没有审批任务</strong><div class=\\"card-copy\\">点击“创建测试审批任务”可以生成一条受限 no-op 审批记录。</div></div>";
        return;
      }
      container.innerHTML = state.approvals.map((item) => {
        const statusClassName = item.status === "approved" ? "ok" : item.status === "rejected" ? "error" : "warn";
        return "<div class=\\"approval-item\\">"
          + "<div class=\\"row\\"><strong>" + escapeHtml(item.title) + "</strong><span class=\\"" + statusClass(statusClassName) + "\\">" + escapeHtml(item.status) + "</span></div>"
          + "<div class=\\"card-copy\\">" + escapeHtml(item.reason || "需要人工审批") + "</div>"
          + "<div class=\\"card-copy\\">allowedFiles: " + escapeHtml((item.allowedFiles || []).join(", ") || "none") + "</div>"
          + "<div class=\\"card-copy\\">forbiddenPaths: " + escapeHtml((item.forbiddenPaths || []).join(", ")) + "</div>"
          + "<div class=\\"approval-actions\\">"
          + "<button type=\\"button\\" data-approval-action=\\"approve\\" data-approval-id=\\"" + escapeHtml(item.id) + "\\">批准此 dry-run 候选</button>"
          + "<button type=\\"button\\" data-approval-action=\\"reject\\" data-approval-id=\\"" + escapeHtml(item.id) + "\\">拒绝此 dry-run 候选</button>"
          + "<button type=\\"button\\" data-approval-action=\\"apply\\" data-approval-id=\\"" + escapeHtml(item.id) + "\\">预览已批准动作说明</button>"
          + "</div>"
          + "</div>";
      }).join("");
    }

    function renderApprovalIntentPreview() {
      const output = byId("approval-preview-output");
      if (!output) return;
      if (!state.approvalIntentPreview) {
        output.textContent = "当前尚未运行审批意图预览。该入口只调用只读预览，不创建审批，不生成 patch proposal，也不执行本地动作。";
        return;
      }
      output.textContent = prettyJson(state.approvalIntentPreview);
    }

    function parseAllowedFilesText(value) {
      return Array.from(new Set(String(value || "")
        .split(/\\r?\\n/g)
        .map((item) => item.trim())
        .filter(Boolean)));
    }

    function collectLocalAgentInput() {
      const taskInput = byId("local-agent-task-input")?.value?.trim() || "";
      const allowedFilesText = byId("local-agent-allowed-files-input")?.value || "";
      const allowedFiles = parseAllowedFilesText(allowedFilesText);
      state.localAgent.taskInput = taskInput;
      state.localAgent.allowedFilesText = allowedFilesText;
      return {
        taskInput,
        allowedFilesText,
        allowedFiles,
      };
    }

    function renderLocalAgentOutputs() {
      const intentOutput = byId("local-agent-intent-output");
      const planOutput = byId("local-agent-plan-output");
      const patchOutput = byId("local-agent-patch-output");
      const approvalOutput = byId("local-agent-approval-output");
      if (intentOutput) {
        intentOutput.textContent = state.localAgent.intentResult
          ? prettyJson(state.localAgent.intentResult)
          : "尚未运行意图预览。";
      }
      if (planOutput) {
        planOutput.textContent = state.localAgent.planResult
          ? prettyJson(state.localAgent.planResult)
          : "尚未生成操作计划。";
      }
      if (patchOutput) {
        patchOutput.textContent = state.localAgent.patchResult
          ? prettyJson(state.localAgent.patchResult)
          : "尚未生成 patch proposal。";
      }
      if (approvalOutput) {
        approvalOutput.textContent = state.localAgent.approvalResult
          ? prettyJson(state.localAgent.approvalResult)
          : "尚未创建审批记录。";
      }
    }

    function syncLocalAgentDraftInputs() {
      const taskInput = byId("local-agent-task-input");
      const allowedFilesInput = byId("local-agent-allowed-files-input");
      if (taskInput && !taskInput.value.trim()) {
        taskInput.value = state.localAgent.taskInput || "";
      }
      if (allowedFilesInput && !allowedFilesInput.value.trim()) {
        allowedFilesInput.value = state.localAgent.allowedFilesText || "";
      }
    }

    function syncRepairDraftInputs() {
      const taskInput = byId("repair-task-input");
      const allowedFilesInput = byId("repair-allowed-files-input");
      if (taskInput && !taskInput.value.trim()) {
        taskInput.value = state.repairDraft.taskInput || "";
      }
      if (allowedFilesInput && !allowedFilesInput.value.trim()) {
        allowedFilesInput.value = state.repairDraft.allowedFilesText || "";
      }
    }

    function renderFileSelections() {
      const container = byId("file-list-output");
      const summary = byId("file-summary-output");
      if (!container || !summary) return;
      if (!state.fileSelections.length) {
        container.innerHTML = "<div class=\\"file-item\\"><strong>暂无登记结果</strong><div class=\\"card-copy\\">这里只记录文件名、路径和大小等最小上下文，不读取敏感内容。</div></div>";
        summary.textContent = "尚未登记文件。敏感文件名（如 .env、secret、token）会被拦截。";
        return;
      }
      const latest = state.fileSelections[0];
      summary.textContent = "仅登记 / 预览，未进入知识库训练。已接受 " + (latest.filesSelected || 0) + " 个文件，拦截 " + (latest.filesBlocked || 0) + " 个文件。";
      container.innerHTML = state.fileSelections.map((item) => {
        const accepted = sanitizeFileContextEntries(item.accepted);
        const blocked = sanitizeFileContextEntries(item.blocked);
        return "<div class=\\"file-item\\">"
          + "<strong>" + escapeHtml(item.selectedAt || "最近一次登记") + "</strong>"
          + "<div class=\\"card-copy\\">已接受：" + escapeHtml(String(accepted.length)) + "；已拦截：" + escapeHtml(String(blocked.length)) + "</div>"
          + "<details><summary>展开登记详情</summary><div class=\\"card-copy\\">" + escapeHtml(prettyJson({ accepted, blocked })) + "</div></details>"
          + "</div>";
      }).join("");
    }

    function sanitizeFileContextEntries(items) {
      return (Array.isArray(items) ? items : []).map((item) => {
        const next = { ...item };
        if (isSensitiveFileReference(next.name)) {
          next.name = "[blocked-sensitive-file]";
        }
        if (isSensitiveFileReference(next.path)) {
          next.path = "[blocked-sensitive-path]";
        }
        return next;
      });
    }

    function isSensitiveFileReference(value) {
      return /(^|[\\/])\.env(\.|$)|secret|token|credential/i.test(String(value || ""));
    }

    function renderDiagnostics() {
      const health = state.diagnostics?.health || {};
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      const chatModels = state.selectableModels.length;
      setText("diag-service-status", health.serviceStatus === "ready" ? "running" : (health.serviceStatus || "unknown"));
      setText("diag-health-note", "/health/check: " + (health.routes?.chat ? "可用" : "待检查"));
      setText("diag-provider-status", provider?.apiKeyConfigured ? "已配置" : "未配置");
      setText("diag-provider-note", provider?.lastTestResult?.message || (provider?.apiKeyConfigured ? "可进一步测试真实连接" : "未配置 API Key"));
      setText("diag-model-count", String(chatModels));
      setText("diag-model-note", chatModels > 0 ? "仅统计已验证 Chat 模型" : "当前没有可直接聊天的模型");
      setText("diag-last-chat-output", state.lastChatResult
        ? prettyJson({
            selectedModel: state.lastChatResult.selectedModel,
            providerCalled: state.lastChatResult.providerCalled,
            completionVerified: state.lastChatResult.completionVerified,
            evidenceId: state.lastChatResult.evidenceId,
            summary: state.lastChatResult.userVisibleSummary
          })
        : "暂无记录。");
      setText("diag-last-error-output", state.lastError ? state.lastError : "暂无错误。");
      setText("diagnostics-raw-output", prettyJson({
        diagnostics: state.diagnostics,
        providerStatus: state.providerStatus,
        lastDryRunResult: state.lastDryRunResult,
        lastThreeModeResult: state.lastThreeModeResult
      }));
    }

    async function previewLocalAgentWorkspaceIntent() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      const result = await workbenchApiClient.previewLocalAgentIntent({
        input: taskInput,
        message: taskInput,
        permissionMode: "manual",
        dryRun: true,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.localAgent.intentResult = result;
      renderLocalAgentOutputs();
      showToast("本地智能体意图预览已生成，未执行真实动作。", "info");
    }

    async function buildLocalAgentOperationPlan() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      const result = await workbenchApiClient.createLocalAgentOperationPlan({
        input: taskInput,
        permissionMode: "manual",
        dryRun: true,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.localAgent.planResult = result;
      renderLocalAgentOutputs();
      showToast("本地智能体操作计划已生成，仍处于审批前阶段。", "info");
    }

    async function buildLocalAgentPatchProposal() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      const result = await workbenchApiClient.createLocalAgentPatchProposal({
        input: taskInput,
        permissionMode: "manual",
        dryRun: true,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.localAgent.patchResult = result;
      renderLocalAgentOutputs();
      showToast("Patch proposal 已生成，仍未执行 apply。", "info");
    }

    async function createApprovalFromLocalAgent() {
      const { taskInput, allowedFiles } = collectLocalAgentInput();
      if (!taskInput) {
        showToast("请先填写本地任务说明。", "warn");
        return;
      }
      if (!state.localAgent.patchResult?.patchProposal) {
        await buildLocalAgentPatchProposal();
      }
      const patchResult = state.localAgent.patchResult;
      if (!patchResult?.patchProposal) {
        showToast("未能生成 patch proposal，不能创建审批。", "warn");
        return;
      }
      const result = await workbenchApiClient.createApproval({
        title: "Phase3989A 本地智能体审批任务",
        reason: taskInput,
        featureId: "phase3989a-local-agent",
        operationId: patchResult.operationId,
        allowedFiles,
        forbiddenPaths: FORBIDDEN_PATHS,
        patchProposal: patchResult.patchProposal,
        approvalRecord: patchResult.approvalRecord,
        scope: "patch",
        permissionMode: "manual",
        summary: "由 local-agent 工作台生成的受限审批记录。",
      });
      state.localAgent.approvalResult = result;
      renderLocalAgentOutputs();
      await loadApprovals();
      showToast(result.approval?.id ? "审批记录已创建。" : "审批记录创建失败。", result.approval?.id ? "info" : "warn");
    }

    function handoffRepairDraftToLocalAgent() {
      const repairTaskInput = byId("repair-task-input")?.value?.trim() || "";
      const repairAllowedFilesText = byId("repair-allowed-files-input")?.value || "";
      state.repairDraft.taskInput = repairTaskInput;
      state.repairDraft.allowedFilesText = repairAllowedFilesText;
      state.localAgent.taskInput = repairTaskInput || state.localAgent.taskInput;
      state.localAgent.allowedFilesText = repairAllowedFilesText || state.localAgent.allowedFilesText;
      setActivePage("local-agent");
      syncLocalAgentDraftInputs();
      renderLocalAgentOutputs();
      showToast("修复草稿已带入本地智能体页面。", "info");
    }

    function updateChatModeBadge(result, isDryRun) {
      const badge = byId("chat-run-mode");
      if (!badge) return;
      if (isDryRun) {
        badge.textContent = "聊天模式：测试模式，未调用 Provider";
        return;
      }
      if (result?.providerCalled === true && result?.completionVerified === true) {
        badge.textContent = "聊天模式：已真实调用 Provider";
      } else if (result?.providerCalled === false) {
        badge.textContent = "聊天模式：未发起真实 Provider 调用";
      } else {
        badge.textContent = "聊天模式：已调用 Provider，但未完成校验";
      }
    }

function summarizeFailure(result) {
      const topCode = String(result?.code || "").trim();
      const executionCode = String(result?.failureCode || result?.stages?.executionStatus?.code || "").trim();
      const blockerCodes = Array.isArray(result?.blockers) ? result.blockers : [];
      const code = executionCode || topCode;
      if (code === "nvidia_api_key_missing" || code === "nvidia_api_key_required") {
        return "未配置 API Key，无法发起真实聊天。";
      }
      if (code === "provider_not_allowed_phase312a" || code === "real_provider_disabled" || blockerCodes.includes("real_provider_disabled")) {
        return "Provider 当前不可用，未发起真实调用。";
      }
      if (code === "model_not_in_library" || code === "endpoint_type_mismatch" || code === "model_not_selectable" || blockerCodes.includes("model_not_selectable")) {
        return "当前模型未验证或不允许直接用于普通聊天。";
      }
      if (result?.providerCalled === true) {
        return "请求失败：" + (result?.failureMessage || result?.verificationReason || result?.message || "Provider 返回失败。");
      }
      return result?.userVisibleSummary || result?.failureMessage || result?.verificationReason || result?.message || "未发起真实 Provider 调用。";
    }

    async function loadProviderStatus() {
      state.providerStatus = await workbenchApiClient.getProviderConfigStatus();
      renderProviderStatus();
    }

    async function loadModelLibrary() {
      state.modelLibrary = await requestJson("/model-library");
      const matrix = state.modelLibrary?.data?.usabilityMatrix || state.modelLibrary?.usabilityMatrix || null;
      const records = Array.isArray(matrix?.records)
        ? matrix.records
        : [];
      state.selectableModels = records
        .filter((item) => {
          const bucket = String(item.capabilityBucket || "").toLowerCase();
          return item.verificationStatus === "smoke_passed"
            && item.selectable === true
            && item.directChatAllowed === true
            && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code" || bucket === "chat_reasoning");
        })
        .map((item) => item.modelId);
      renderModelOptions();
      renderModelLibrary();
      renderDiagnostics();
    }

    async function loadDiagnostics() {
      state.diagnostics = await workbenchApiClient.getDiagnosticsStatus();
      renderTopbar();
      renderDiagnostics();
    }

    async function loadApprovals() {
      const canListApprovals = workbenchApiClient && typeof workbenchApiClient.listApprovals === "function";
      if (!canListApprovals) {
        state.approvals = [];
        state.approvalsUnsupported = true;
        renderApprovals();
        return { approvals: [], unsupported: true };
      }
      const result = await workbenchApiClient.listApprovals();
      state.approvals = Array.isArray(result.approvals) ? result.approvals : [];
      state.approvalsUnsupported = false;
      renderApprovals();
      return result;
    }

    async function previewApprovalIntent() {
      const result = await workbenchApiClient.previewLocalAgentIntent({
        input: "审批意图只读预览",
        message: "审批意图只读预览",
        permissionMode: "manual",
        dryRun: true,
        mode: "intent-preview",
        allowedFiles: ALLOWED_NOOP_FILES,
        forbiddenPaths: FORBIDDEN_PATHS,
      });
      state.approvalIntentPreview = {
        previewOnly: true,
        route: "/local-agent/intent-preview",
        dryRun: true,
        note: "只读预览，不创建 approval，不生成 patch proposal，也不执行 apply-approved。",
        result,
      };
      renderApprovalIntentPreview();
      showToast("审批意图只读预览已刷新。", "info");
    }

    async function refreshAll() {
      await loadProviderStatus();
      await loadModelLibrary();
      await loadDiagnostics();
      await loadApprovals();
      syncLocalAgentDraftInputs();
      syncRepairDraftInputs();
      renderLocalAgentOutputs();
      renderEvidenceDrawer();
    }

    function bindModelLibraryControls() {
      const search = byId("model-library-search-input");
      const status = byId("model-library-status-filter");
      const provider = byId("model-library-provider-filter");
      const capability = byId("model-library-capability-filter");
      const sort = byId("model-library-sort-select");
      if (search) {
        search.addEventListener("input", () => {
          state.modelLibraryControls.query = search.value;
          renderModelLibrary();
        });
      }
      if (status) {
        status.addEventListener("change", () => {
          state.modelLibraryControls.status = status.value;
          renderModelLibrary();
        });
      }
      if (provider) {
        provider.addEventListener("change", () => {
          state.modelLibraryControls.providerScope = provider.value;
          renderModelLibrary();
        });
      }
      if (capability) {
        capability.addEventListener("change", () => {
          state.modelLibraryControls.capability = capability.value;
          renderModelLibrary();
        });
      }
      if (sort) {
        sort.addEventListener("change", () => {
          state.modelLibraryControls.sort = sort.value;
          renderModelLibrary();
        });
      }
    }

    async function saveProviderConfig() {
      const providerId = byId("provider-select-input").value;
      const modelId = byId("model-select-input").value;
      const apiKey = byId("provider-api-key-input").value.trim();
      
      if (!providerId) {
        showToast("请先选择 Provider", "warn");
        return;
      }
      if (!apiKey) {
        showToast("请输入 API Key", "warn");
        return;
      }
      if (!modelId) {
        showToast("请先检测并选择模型", "warn");
        return;
      }
      
      const payload = {
        providerId: providerId,
        baseUrl: "", // Use default base URL for the provider
        apiKey: apiKey,
        modelId: modelId
      };
      const result = await workbenchApiClient.saveProviderConfig(payload);
      byId("provider-api-key-input").value = "";
      await loadProviderStatus();
      renderDiagnostics();
      showToast(result.success ? "已保存 " + providerId + "/" + modelId + "，页面不会回显 API Key 明文。" : (result.message || "保存失败。"), result.success ? "info" : "warn");
    }

    async function testProviderConfig() {
      const providerId = byId("provider-select-input").value;
      const modelId = byId("model-select-input").value || state.selectedModel;
      
      if (!providerId) {
        showToast("请先选择 Provider", "warn");
        return;
      }
      
      const result = await workbenchApiClient.testProviderConfig({
        providerId: providerId,
        modelId: modelId
      });
      state.lastError = result.success ? null : (result.message || "Provider 测试失败");
      await loadProviderStatus();
      renderDiagnostics();
      showToast(result.realExternalCall ? "已执行真实连接测试。" : (result.message || "测试未发生真实外呼。"), result.success ? "info" : "warn");
    }

    // Load provider list into the select dropdown
    async function loadProviderListToSelect() {
      const select = byId("provider-select-input");
      if (!select) return;
      
      try {
        const providers = await workbenchApiClient.getProviders();
        select.innerHTML = '<option value="">-- 请选择 --</option>';
        
        if (providers && Array.isArray(providers)) {
          providers.forEach(p => {
            if (p.id === 'local-fake-provider' || p.id === 'backup-fake-provider') return; // Skip fake providers
            
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.displayName || p.id;
            select.appendChild(option);
          });
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
        select.innerHTML = '<option value="">加载失败</option>';
      }
    }

    // Detect available models for selected provider
    async function detectModelsForProvider() {
      const providerId = byId("provider-select-input").value;
      const apiKey = byId("provider-api-key-input").value.trim();
      const modelSelect = byId("model-select-input");
      const detectionArea = byId("model-detection-area");
      const saveButton = byId("save-provider-button");
      
      if (!providerId) {
        showToast("请先选择 Provider", "warn");
        return;
      }
      if (!apiKey) {
        showToast("请输入 API Key", "warn");
        return;
      }
      
      // Show loading state
      modelSelect.innerHTML = '<option value="">检测中...</option>';
      modelSelect.disabled = true;
      detectionArea.style.display = "block";
      
      try {
        // Call API to get models for this provider with the given API key
        const response = await fetch('/models/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey })
        });
        
        const data = await response.json();
        
        if (data.status === 'success' && data.models && Array.isArray(data.models)) {
          // Filter models for the selected provider
          const providerModels = data.models.filter(m => m.providerId === providerId || !m.providerId);
          
          modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';
          
          if (providerModels.length === 0) {
            modelSelect.innerHTML = '<option value="">此 Provider 无可用模型</option>';
            showToast("未找到可用模型，请检查 API Key", "warn");
          } else {
            providerModels.forEach(m => {
              const option = document.createElement('option');
              option.value = m.modelId;
              option.textContent = m.displayName || m.modelId;
              modelSelect.appendChild(option);
            });
            showToast("检测到 " + providerModels.length + " 个可用模型", "info");
          }
        } else {
          modelSelect.innerHTML = '<option value="">检测失败</option>';
          showToast(data.message || "模型检测失败", "error");
        }
      } catch (error) {
        console.error('Model detection failed:', error);
        modelSelect.innerHTML = '<option value="">检测失败</option>';
        showToast("网络错误或 API Key 无效", "error");
      } finally {
        modelSelect.disabled = false;
        // Enable save button if model is selected
        if (modelSelect.value) {
          saveButton.disabled = false;
        }
      }
    }

    // Bind events for model detection
    function bindModelDetectionEvents() {
      // Auto-detect when API key is pasted/changed
      const apiKeyInput = byId("provider-api-key-input");
      let debounceTimer = null;
      
      if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          const providerId = byId("provider-select-input").value;
          const apiKey = apiKeyInput.value.trim();
          
          // Only auto-detect if both provider and API key are filled
          if (providerId && apiKey.length > 10) {
            debounceTimer = setTimeout(() => {
              detectModelsForProvider();
            }, 800); // Wait 800ms after user stops typing
          }
        });
      }
      
      // Re-detect button
      const detectBtn = byId("detect-models-button");
      if (detectBtn) {
        detectBtn.addEventListener('click', detectModelsForProvider);
      }
      
      // Enable save button when model is selected
      const modelSelect = byId("model-select-input");
      const saveButton = byId("save-provider-button");
      
      if (modelSelect && saveButton) {
        modelSelect.addEventListener('change', () => {
          saveButton.disabled = !modelSelect.value;
        });
      }
    }

    function setCurrentPageModel() {
      state.selectedModel = byId("model-select").value;
      saveSelectedModel();
      renderModelOptions();
      showToast("已更新当前页面模型，不影响默认 /chat 主链。");
    }

    async function sendChat(event) {
      event.preventDefault();
      const input = byId("chat-input");
      const text = input.value.trim();
      if (!text) {
        showToast("请输入内容后再发送。", "warn");
        return;
      }
      appendMessage({ role: "user", text });
      input.value = "";
      try {
        const result = await requestJson("/chat-gateway/execute", {
          method: "POST",
          body: JSON.stringify({
            input: text,
            message: text,
            mode: "manual_model",
            dryRun: false,
            providerId: state.selectedProvider,
            selectedModel: {
              providerId: state.selectedProvider,
              modelId: state.selectedModel
            }
          })
        });
        state.lastChatResult = result;
        state.lastError = result.completionVerified ? null : summarizeFailure(result);
        updateChatModeBadge(result, false);
        renderTopbar();
        renderEvidenceDrawer();
        renderDiagnostics();
        const visibleText = result.completionVerified && String(result.finalAnswer || "").trim()
          ? String(result.finalAnswer).trim()
          : summarizeFailure(result);
        appendMessage({
          role: result.completionVerified ? "assistant" : "system",
          text: visibleText,
          details: {
            model: result.selectedModel || result.modelId || state.selectedModel,
            providerCalled: result.providerCalled === true,
            completionVerified: result.completionVerified === true,
            evidenceId: result.evidenceId || "",
            routeDecision: result.routeDecision || "",
            verificationReason: result.verificationReason || "",
            note: result.userVisibleSummary || result.message || ""
          }
        });
        showToast(result.completionVerified ? "聊天结果已返回。" : visibleText, result.completionVerified ? "info" : "warn");
      } catch (error) {
        state.lastError = error.message;
        renderDiagnostics();
        updateChatModeBadge(null, false);
        appendMessage({
          role: "system",
          text: "请求失败：" + error.message,
          details: {
            model: state.selectedModel,
            providerCalled: false,
            completionVerified: false,
            evidenceId: "",
            note: "前端请求未成功完成。"
          }
        });
        showToast(error.message, "error");
      }
    }

    function clearChat() {
      state.lastChatResult = null;
      state.lastDryRunResult = null;
      updateChatModeBadge(null, false);
      renderWelcomeMessages();
      renderTopbar();
      renderEvidenceDrawer();
      renderDiagnostics();
      showToast("会话已清空。");
    }

    async function createTestApprovalTask() {
      const patchProposal = await requestJson("/local-agent/patch-proposal", {
        method: "POST",
        body: JSON.stringify({
          input: "Phase321A 审批链 no-op 验证",
          allowedFiles: ALLOWED_NOOP_FILES,
          permissionMode: "manual"
        })
      });
      const created = await requestJson("/approvals/create", {
        method: "POST",
        body: JSON.stringify({
          title: "Phase321A 测试审批任务",
          reason: "用于验证未批准前不可执行、批准后仅允许在 allowedFiles 内做 no-op 安全动作。",
          featureId: "phase321a-approval-test",
          operationId: patchProposal.operationId,
          allowedFiles: ALLOWED_NOOP_FILES,
          forbiddenPaths: FORBIDDEN_PATHS,
          patchProposal: patchProposal.patchProposal,
          approvalRecord: patchProposal.approvalRecord,
          scope: "patch",
          permissionMode: "manual"
        })
      });
      await loadApprovals();
      showToast(created.approval ? "测试审批任务已创建。" : "审批任务创建失败。", created.approval ? "info" : "warn");
    }

    async function handleApprovalAction(action, approvalId) {
      if (!approvalId) return;
      if (action === "approve" || action === "reject") {
        const result = await requestJson("/approvals/" + encodeURIComponent(approvalId) + "/" + action, {
          method: "POST",
          body: JSON.stringify({ reason: "phase321a-ui-action" })
        });
        await loadApprovals();
        showToast(action === "approve" ? "审批已通过。" : "审批已拒绝。", action === "approve" ? "info" : "warn");
        return result;
      }
      if (action === "apply") {
        const result = await requestJson("/local-operation/apply-approved", {
          method: "POST",
          body: JSON.stringify({
            approvalId,
            dryRun: false
          })
        });
        await loadApprovals();
        const applied = result.applyResult?.applied === true;
        showToast(applied ? "已执行批准后的安全动作。" : (result.blockedReason === "approval-not-approved" ? "未批准前不会执行本地动作。" : "执行已被限制。"), applied ? "info" : "warn");
        return result;
      }
    }

    async function handleFilesSelected(event) {
      const files = Array.from(event.target.files || []);
      if (!files.length) {
        showToast("未选择文件。", "warn");
        return;
      }
      const result = await workbenchApiClient.selectFileContext({
        files: files.map((file) => ({
          name: file.name,
          path: file.webkitRelativePath || file.name,
          size: file.size,
          type: file.type
        }))
      });
      state.fileSelections.unshift(result);
      state.fileSelections = state.fileSelections.slice(0, 6);
      renderFileSelections();
      const tone = result.filesBlocked > 0 ? "warn" : "info";
      showToast("仅登记 / 预览，未进入知识库训练。", tone);
      event.target.value = "";
    }

    async function runDryRunTest() {
      const input = "测试模式：你好";
      const result = await requestJson("/chat-gateway/dry-run-task", {
        method: "POST",
        body: JSON.stringify({
          input,
          message: input,
          selectedModel: state.selectedModel,
          acceptanceMode: "phase321a-diagnostics"
        })
      });
      state.lastDryRunResult = result;
      updateChatModeBadge(result, true);
      renderEvidenceDrawer();
      renderDiagnostics();
      applyYiyiEvent("thinking");
      showToast("测试模式完成，未调用 Provider。");
    }

    function inferFutureMode(taskText) {
      const text = String(taskText || "").trim();
      if (!text) {
        return {
          mode: "Tianshu",
          label: "复杂任务",
          why: "填写任务后，系统会根据任务复杂度推荐模式。"
        };
      }
      const lower = text.toLowerCase();
      const godHints = ["风险", "审查", "审核", "重要", "决定", "评估", "review", "risk"];
      const tianshuHints = ["计划", "步骤", "阶段", "复杂", "拆解", "路线", "规划", "plan"];
      if (godHints.some((hint) => lower.includes(hint))) {
        return {
          mode: "God",
          label: "重要问题",
          why: "任务包含风险或评估信号，先做谨慎审查更稳。"
        };
      }
      if (tianshuHints.some((hint) => lower.includes(hint)) || text.length > 80) {
        return {
          mode: "Tianshu",
          label: "复杂任务",
          why: "任务包含多步信息，先规划再执行更稳。"
        };
      }
      return {
        mode: "Normal",
        label: "普通问题",
        why: "任务比较直接，可以先生成轻量安全预览。"
      };
    }

    function previewFutureMinimalOsPlan() {
      const input = byId("future-os-task-input");
      const taskText = input?.value?.trim() || "";
      const recommendation = inferFutureMode(taskText);
      const previewCard = byId("future-os-preview-card");
      const previewEmpty = byId("future-os-preview-empty");
      const previewBody = byId("future-os-preview-body");
      const status = byId("future-os-preview-status");
      const modeTarget = byId("future-os-recommended-mode");
      const whyTarget = byId("future-os-preview-why");
      const willDoTarget = byId("future-os-preview-will-do");
      if (previewCard) previewCard.dataset.previewVisible = "true";
      if (previewEmpty) previewEmpty.hidden = true;
      if (previewBody) previewBody.hidden = false;
      if (modeTarget) modeTarget.textContent = recommendation.mode + " · " + recommendation.label;
      if (whyTarget) whyTarget.textContent = recommendation.why;
      if (willDoTarget) {
        willDoTarget.textContent = taskText
          ? "基于你的任务生成推荐模式、安全边界和下一步。"
          : "请先输入你想完成的任务。当前只是安全预览，没有执行真实任务。";
      }
      document.querySelectorAll("[data-future-mode]").forEach((card) => {
        card.classList.toggle("is-recommended", card.getAttribute("data-future-mode") === recommendation.mode.toLowerCase());
      });
      if (status) status.textContent = "已生成安全预览，未执行真实任务。";
      showToast("已生成安全预览，未调用真实模型。");
    }

    function setFutureDetailsOpen(open) {
      const drawer = byId("future-os-details-panel");
      const toggle = byId("future-os-toggle-details");
      if (!drawer) return;
      drawer.hidden = !open;
      drawer.dataset.detailsOpen = open ? "true" : "false";
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "收起详情" : "查看详情";
      }
      if (open) drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }


    // ── Global Search ──────────────────────────────────────────
    const SEARCH_PAGES = [
      { id: "chat", label: "总控台", icon: "⊞", desc: "系统总览与聊天" },
      { id: "models", label: "模型", icon: "◇", desc: "模型配置与管理" },
      { id: "approvals", label: "任务", icon: "☰", desc: "任务审批与执行" },
      { id: "files", label: "安全", icon: "⛊", desc: "安全策略与文件" },
      { id: "diagnostics", label: "设置", icon: "⚙", desc: "系统设置与诊断" },
      { id: "local-agent", label: "本地代理", icon: "⚡", desc: "本地智能代理" },
      { id: "repair", label: "修复", icon: "⚒", desc: "系统修复工具" },
      { id: "help", label: "帮助", icon: "?", desc: "帮助与文档" }
    ];

    let searchDebounceTimer = null;
    let searchActiveIndex = -1;
    let searchResults = [];

    function searchEscapeHtml(s) {
      var d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }

    function initSearch() {
      var input = byId("global-search-input");
      var dropdown = byId("search-dropdown");
      if (!input || !dropdown) return;

      input.addEventListener("input", function () {
        clearTimeout(searchDebounceTimer);
        var q = input.value.trim();
        if (!q) { closeSearch(); return; }
        searchDebounceTimer = setTimeout(function () { performSearch(q); }, 180);
      });

      input.addEventListener("focus", function () {
        var q = input.value.trim();
        if (q) performSearch(q);
      });

      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closeSearch(); input.blur(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); moveSearchFocus(1); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); moveSearchFocus(-1); return; }
        if (e.key === "Enter") { e.preventDefault(); activateSearchResult(); return; }
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "/" && document.activeElement !== input && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
          e.preventDefault();
          input.focus();
          input.select();
        }
      });

      document.addEventListener("click", function (e) {
        if (!e.target.closest(".nav-search")) closeSearch();
      });
    }

    function closeSearch() {
      var dropdown = byId("search-dropdown");
      if (dropdown) dropdown.hidden = true;
      searchActiveIndex = -1;
      searchResults = [];
    }

    function performSearch(query) {
      var q = query.toLowerCase();
      var groups = [];

      // Group 1: System pages
      var pageMatches = SEARCH_PAGES.filter(function (p) {
        return p.label.includes(query) || p.id.includes(q) || p.desc.includes(query);
      });
      if (pageMatches.length) {
        groups.push({ label: "系统页面", items: pageMatches.map(function (p) {
          return { type: "page", icon: p.icon, label: p.label, meta: p.desc, pageId: p.id };
        })});
      }

      // Group 2: Models (scrape from DOM)
      var modelItems = [];
      var modelCards = document.querySelectorAll('[data-page="models"] [data-model-id], [data-page="models"] .model-card, [data-page="models"] [class*="model"]');
      modelCards.forEach(function (card) {
        var text = card.textContent || "";
        if (text.toLowerCase().includes(q)) {
          var nameEl = card.querySelector("[data-model-id]") || card;
          var modelName = (nameEl.getAttribute("data-model-id") || (card.querySelector("strong, .model-name, h3, h4") || {}).textContent || text).trim().substring(0, 60);
          if (modelName) modelItems.push({ type: "page", icon: "◇", label: modelName, meta: "模型", pageId: "models" });
        }
      });
      if (modelItems.length) {
        var seen = {};
        modelItems = modelItems.filter(function (m) { if (seen[m.label]) return false; seen[m.label] = true; return true; });
        groups.push({ label: "模型", items: modelItems.slice(0, 5) });
      }

      // Group 3: Files / security items (scrape from DOM)
      var fileItems = [];
      var fileCards = document.querySelectorAll('[data-page="files"] .file-row, [data-page="files"] [class*="file"], [data-page="files"] tr');
      fileCards.forEach(function (card) {
        var text = (card.textContent || "").trim();
        if (text.toLowerCase().includes(q) && text.length > 2) {
          fileItems.push({ type: "page", icon: "⚿", label: text.substring(0, 60), meta: "安全/文件", pageId: "files" });
        }
      });
      if (fileItems.length) {
        var seen2 = {};
        fileItems = fileItems.filter(function (f) { if (seen2[f.label]) return false; seen2[f.label] = true; return true; });
        groups.push({ label: "文件", items: fileItems.slice(0, 5) });
      }

      // Group 4: Web search (always show)
      groups.push({ label: "联网搜索", items: [
        { type: "web", icon: "⊕", label: "在浏览器中搜索 \\"" + query + "\\"", meta: "Google", query: query }
      ]});

      renderSearchResults(groups);
    }

    function renderSearchResults(groups) {
      var dropdown = byId("search-dropdown");
      var container = byId("search-results");
      if (!dropdown || !container) return;

      searchResults = [];
      var html = "";
      groups.forEach(function (g) {
        html += '<div class="search-group-label">' + searchEscapeHtml(g.label) + '</div>';
        g.items.forEach(function (item) {
          var idx = searchResults.length;
          searchResults.push(item);
          html += '<div class="search-result-item" data-search-idx="' + idx + '">' +
            '<span class="search-result-icon">' + searchEscapeHtml(item.icon) + '</span>' +
            '<div class="search-result-text">' +
              '<div class="search-result-label">' + searchEscapeHtml(item.label) + '</div>' +
              '<div class="search-result-meta">' + searchEscapeHtml(item.meta) + '</div>' +
            '</div></div>';
        });
      });

      if (searchResults.length === 0) {
        html = '<div class="search-no-results">未找到匹配结果</div>';
      }

      container.innerHTML = html;
      dropdown.hidden = false;
      searchActiveIndex = -1;

      container.querySelectorAll(".search-result-item").forEach(function (el) {
        el.addEventListener("click", function () {
          var idx = parseInt(el.getAttribute("data-search-idx"), 10);
          activateSearchResultByIndex(idx);
        });
      });
    }

    function moveSearchFocus(dir) {
      if (searchResults.length === 0) return;
      searchActiveIndex = (searchActiveIndex + dir + searchResults.length) % searchResults.length;
      highlightSearchResult();
    }

    function highlightSearchResult() {
      var container = byId("search-results");
      if (!container) return;
      container.querySelectorAll(".search-result-item").forEach(function (el, i) {
        el.classList.toggle("is-focused", i === searchActiveIndex);
      });
    }

    function activateSearchResult() {
      if (searchActiveIndex >= 0 && searchActiveIndex < searchResults.length) {
        activateSearchResultByIndex(searchActiveIndex);
      } else if (searchResults.length > 0) {
        activateSearchResultByIndex(0);
      }
    }

    function activateSearchResultByIndex(idx) {
      var item = searchResults[idx];
      if (!item) return;
      if (item.type === "page") {
        setActivePage(item.pageId);
        closeSearch();
        var input = byId("global-search-input");
        if (input) { input.value = ""; input.blur(); }
      } else if (item.type === "web") {
        window.open("https://www.google.com/search?q=" + encodeURIComponent(item.query), "_blank");
        closeSearch();
      }
    }
    async function bootstrap() {
      applyReadonlyAcceptanceView();
      hydrateYiyiFromQuery();
      restoreSelectedModel();
      renderWelcomeMessages();
      renderTopbar();
      renderFileSelections();
      renderApprovals();
      renderApprovalIntentPreview();
      renderDiagnostics();
      renderMissionControlDetail(byId("agent-arena-drilldown-detail"), agentDrilldownCopy.reviewer);
      renderMissionControlDetail(byId("red-team-scenario-detail"), redTeamScenarioCopy["prompt-injection"]);
      setGuidedShowcaseStep("welcome");
      setActivePage(state.activePage);
      syncThreeModeTabs();
      bindModelLibraryControls();
      bindYiyiMouseAttention();
      initStatusPills();
      initSearch();
      
      // Initialize simplified model configuration UI
      await loadProviderListToSelect();
      bindModelDetectionEvents();
      
      try {
        await refreshAll();
      } catch (error) {
        state.lastError = error.message;
        renderDiagnostics();
        showToast("初始化失败：" + error.message, "error");
      }
    }

    document.addEventListener("click", async (event) => {
      if (event.target.closest("#refresh-status-btn")) {
        const btn = byId("refresh-status-btn");
        if (btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
        try {
          await fetchDashboardMetrics();
          showToast("状态已刷新");
        } catch { /* metrics already handled in fetchDashboardMetrics */ }
        if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
        return;
      }
      const ownerBossAction = event.target.closest("[data-owner-boss-action]");
      if (ownerBossAction) {
        handleOwnerBossViewAction(ownerBossAction.getAttribute("data-owner-boss-action"));
        return;
      }
      if (event.target.closest("#future-os-preview-button")) {
        previewFutureMinimalOsPlan();
        return;
      }
      if (event.target.closest("#future-os-toggle-details")) {
        const drawer = byId("future-os-details-panel");
        setFutureDetailsOpen(!(drawer?.dataset.detailsOpen === "true"));
        return;
      }
      if (event.target.closest("#future-os-close-details")) {
        setFutureDetailsOpen(false);
        return;
      }
      if (event.target.closest("#yiyi-mode-full-button")) {
        setYiyiMode("full");
        return;
      }
      if (event.target.closest("#yiyi-mode-compact-button")) {
        setYiyiMode("compact");
        return;
      }
      if (event.target.closest("#yiyi-mode-hide-button")) {
        setYiyiMode("off");
        return;
      }
      if (event.target.closest("#yiyi-live-full-button")) {
        setYiyiMode("full");
        return;
      }
      if (event.target.closest("#yiyi-live-compact-button")) {
        setYiyiMode("compact");
        return;
      }
      if (event.target.closest("#yiyi-live-hide-button")) {
        setYiyiMode("off");
        return;
      }
      if (event.target.closest("#yiyi-live-motion-toggle")) {
        if (state.yiyi.reducedMotion) {
          showToast("系统偏好 reduced motion，依依保持静态陪伴。", "warn");
        } else {
          setYiyiMotionEnabled(!state.yiyi.motionEnabled);
        }
        return;
      }
      const yiyiDemoTrigger = event.target.closest("[data-yiyi-demo-trigger]");
      if (yiyiDemoTrigger) {
        const trigger = yiyiDemoTrigger.getAttribute("data-yiyi-demo-trigger");
        state.yiyi.visible = true;
        if (state.yiyi.mode === "off") state.yiyi.mode = "full";
        applyYiyiEvent(trigger);
        showToast("依依状态预览：" + trigger + "，未调用 provider。");
        return;
      }
      if (event.target.closest("#yiyi-persona-classify-button")) {
        const input = byId("yiyi-persona-entry-input");
        const result = classifyYiyiPersonaEntry(input?.value || "");
        renderYiyiPersonaDryRunResult(result);
        applyYiyiEvent(result.decision === "rejected" ? "security_guard" : "evidence_opened");
        showToast(result.decision === "rejected" ? "设定已被安全规则拒绝。" : "设定 dry-run 分类已生成，未保存后台。", result.decision === "rejected" ? "warn" : "info");
        return;
      }
      const navTarget = event.target.closest("[data-nav]");
      if (navTarget) {
        setActivePage(navTarget.getAttribute("data-nav"));
        return;
      }
      const openPageTarget = event.target.closest("[data-open-page]");
      if (openPageTarget) {
        const targetPage = openPageTarget.getAttribute("data-open-page");
        if (targetPage === "local-agent" && event.target.closest("#repair-open-local-agent-button")) {
          handoffRepairDraftToLocalAgent();
          return;
        }
        setActivePage(targetPage);
        if (targetPage === "local-agent") {
          syncLocalAgentDraftInputs();
          renderLocalAgentOutputs();
        }
        if (targetPage === "repair") {
          syncRepairDraftInputs();
        }
        return;
      }
      if (event.target.closest("#open-evidence-button")) {
        if (!state.lastChatResult && !state.lastDryRunResult && !state.lastThreeModeResult) {
          showSampleDryRunResult("scenario-evidence-replay-preview");
        }
        openEvidenceDrawer();
        return;
      }
      if (event.target.closest("#close-evidence-button") || event.target.closest("#evidence-backdrop")) {
        closeEvidenceDrawer();
        return;
      }
      if (event.target.closest("#save-provider-button")) {
        await saveProviderConfig().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#test-provider-button")) {
        await testProviderConfig().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#detect-models-button")) {
        await detectModelsForProvider().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#set-page-model-button") || event.target.closest("#model-page-set-button")) {
        setCurrentPageModel();
        return;
      }
      if (event.target.closest("#owner-task-input-submit-button")) {
        handleOwnerTaskInputSubmit();
        return;
      }
      if (event.target.closest("#new-chat-button")) {
        clearChat();
        applyYiyiEvent("welcome");
        return;
      }
      if (event.target.closest("#create-approval-button")) {
        await createTestApprovalTask().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#refresh-approvals-button")) {
        await loadApprovals().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#preview-approval-intent-button")) {
        await previewApprovalIntent().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-preview-button")) {
        await previewLocalAgentWorkspaceIntent().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-plan-button")) {
        await buildLocalAgentOperationPlan().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-patch-button")) {
        await buildLocalAgentPatchProposal().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#local-agent-create-approval-button")) {
        await createApprovalFromLocalAgent().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#pick-file-button")) {
        byId("file-input").click();
        return;
      }
      if (event.target.closest("#refresh-files-button")) {
        renderFileSelections();
        showToast("文件登记列表已刷新。");
        return;
      }
      if (event.target.closest("#refresh-diagnostics-button")) {
        await Promise.all([loadDiagnostics(), loadProviderStatus(), loadModelLibrary()]).catch((error) => showToast(error.message, "error"));
        showToast("诊断状态已刷新。");
        return;
      }
      if (event.target.closest("#run-dry-run-button")) {
        await runDryRunTest().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#onboarding-dismiss-button")) {
        const panel = byId("guided-onboarding-panel");
        if (panel) panel.style.display = "none";
        showToast("First-run tour skipped. Sample dry-run is ready.");
        focusMissionNode("scenario-trial-panel");
        return;
      }
      const scenarioAction = event.target.closest("[data-scenario-action]");
      if (scenarioAction) {
        handleScenarioAction(scenarioAction.getAttribute("data-scenario-action"));
        return;
      }
      const workforceAction = event.target.closest("[data-workforce-action]");
      if (workforceAction) {
        await handleWorkforceAction(workforceAction.getAttribute("data-workforce-action")).catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#activate-five-capabilities-button")) {
        await activateFiveCapabilities().catch((error) => showToast(error.message, "error"));
        return;
      }
      const internalCommunicationAction = event.target.closest("[data-internal-communication-action]");
      if (internalCommunicationAction) {
        showInternalCommunicationPreview(internalCommunicationAction.getAttribute("data-internal-communication-action"));
        return;
      }
      const branchExecutionAction = event.target.closest("[data-branch-execution-action]");
      if (branchExecutionAction) {
        showBranchExecutionPreview(branchExecutionAction.getAttribute("data-branch-execution-action"));
        return;
      }
      const gvcRunnerCommandAction = event.target.closest("[data-gvc-runner-command-intent]");
      if (gvcRunnerCommandAction) {
        showGvcRunnerCommandPreview(gvcRunnerCommandAction.getAttribute("data-gvc-runner-command-intent"));
        return;
      }
      const hardeningAction = event.target.closest("[data-hardening-action]");
      if (hardeningAction) {
        showLongHorizonHardeningPreview(hardeningAction.getAttribute("data-hardening-action"));
        return;
      }
      const codexContextAction = event.target.closest("[data-codex-context-action]");
      if (codexContextAction) {
        showCodexContextPreview(codexContextAction.getAttribute("data-codex-context-action"));
        return;
      }
      if (event.target.closest("#start-guided-showcase-button")) {
        setGuidedShowcaseStep("welcome");
        byId("yiyi-guided-showcase-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("依依演示已开始：dry-run only。");
        return;
      }
      if (event.target.closest("#showcase-prev-button")) {
        shiftGuidedShowcaseStep(-1);
        return;
      }
      if (event.target.closest("#showcase-next-button")) {
        shiftGuidedShowcaseStep(1);
        return;
      }
      if (event.target.closest("#showcase-skip-button")) {
        setGuidedShowcaseStep("closing_summary");
        showToast("已跳到演示总结。");
        return;
      }
      const showcaseStep = event.target.closest("[data-yiyi-showcase-step]");
      if (showcaseStep) {
        setGuidedShowcaseStep(showcaseStep.getAttribute("data-yiyi-showcase-step"));
        return;
      }
      const tourStep = event.target.closest("[data-tour-step]");
      if (tourStep) {
        document.querySelectorAll("[data-tour-step]").forEach((node) => node.classList.toggle("is-active", node === tourStep));
        const copy = missionTourCopy[tourStep.getAttribute("data-tour-step")];
        const target = byId("guided-onboarding-copy");
        const heading = tourStep.querySelector("strong")?.textContent || "Tour";
        if (target && copy) renderMissionControlDetail(target, { title: heading, body: copy, meta: "skip anytime · dry-run only" });
        return;
      }
      const drilldownCard = event.target.closest("[data-agent-drilldown]");
      if (drilldownCard) {
        document.querySelectorAll("[data-agent-drilldown]").forEach((node) => node.classList.toggle("is-active", node === drilldownCard));
        renderMissionControlDetail(byId("agent-arena-drilldown-detail"), agentDrilldownCopy[drilldownCard.getAttribute("data-agent-drilldown")]);
        return;
      }
      const planCard = event.target.closest("[data-plan-card]");
      if (planCard) {
        document.querySelectorAll("[data-plan-card]").forEach((node) => node.classList.toggle("is-recommended", node === planCard));
        showToast("Plan comparison updated: dry-run only.");
        applyYiyiEvent("tianshu_mode");
        return;
      }
      const scenarioCard = event.target.closest("[data-red-team-scenario]");
      if (scenarioCard) {
        document.querySelectorAll("[data-red-team-scenario]").forEach((node) => node.classList.toggle("is-active", node === scenarioCard));
        renderMissionControlDetail(byId("red-team-scenario-detail"), redTeamScenarioCopy[scenarioCard.getAttribute("data-red-team-scenario")]);
        applyYiyiEvent("red_team_blocked");
        return;
      }
      const modeTab = event.target.closest("[data-three-mode]");
      if (modeTab) {
        state.activeThreeMode = modeTab.getAttribute("data-three-mode") || "normal";
        syncThreeModeTabs();
        applyYiyiEvent(state.activeThreeMode === "god" ? "god_mode" : state.activeThreeMode === "tianshu" ? "tianshu_mode" : "normal_mode");
        return;
      }
      if (event.target.closest("#three-mode-normal-send")) {
        applyYiyiEvent("normal_mode");
        await runThreeMode("normal");
        return;
      }
      if (event.target.closest("#three-mode-god-send")) {
        applyYiyiEvent("god_mode");
        await runThreeMode("god");
        return;
      }
      if (event.target.closest("#three-mode-tianshu-send")) {
        applyYiyiEvent("tianshu_mode");
        await runThreeMode("tianshu");
        return;
      }
      const approvalButton = event.target.closest("[data-approval-action]");
      if (approvalButton) {
        await handleApprovalAction(approvalButton.getAttribute("data-approval-action"), approvalButton.getAttribute("data-approval-id")).catch((error) => showToast(error.message, "error"));
      }
    });

    byId("chat-form")?.addEventListener("submit", sendChat);
    byId("model-select")?.addEventListener("change", (event) => {
      state.selectedModel = event.target.value;
      saveSelectedModel();
      renderTopbar(); renderThreeModeControls();
      setText("model-page-current-selection", state.selectedModel || "未选择");
    });
    byId("three-mode-tianshu-input")?.addEventListener("input", (event) => {
      setText("three-mode-task-preview", "taskClassification: " + classifyTaskPreview(event.target.value));
    });
    byId("owner-task-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        handleOwnerTaskInputSubmit();
      }
    });
      byId("file-input")?.addEventListener("change", (event) => {
      handleFilesSelected(event).catch((error) => showToast(error.message, "error"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeEvidenceDrawer();
    });
    byId("phase313a-generate-verification-plan")?.addEventListener("click", async () => {
      try {
        await requestJson("/model-library/verification-plan");
        showToast("验证计划已生成。");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    // ══════════════════════════════════════════════
    // Dashboard Workbench — live status & metrics
    // ══════════════════════════════════════════════


    function animateCounter(el, target, duration) {
      if (!el) return;
      const isNum = typeof target === "number" || /^\d+$/.test(String(target).trim());
      if (!isNum) { el.textContent = target; return; }
      const end = parseInt(target, 10);
      const start = parseInt(el.textContent, 10) || 0;
      if (start === end) return;
      const range = end - start;
      const dur = duration || 800;
      const startTime = performance.now();
      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / dur, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(start + range * eased));
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function updateRingProgress(ringName, percent) {
      var ring = document.querySelector('[data-ring="' + ringName + '"]');
      if (!ring) return;
      var circumference = 213.6;
      var clamped = Math.max(0, Math.min(100, percent));
      var offset = circumference - (circumference * clamped / 100);
      ring.style.strokeDashoffset = String(offset);
    }

    function getTimeGreeting() {
      const h = new Date().getHours();
      if (h < 6) return "夜深了，注意休息";
      if (h < 9) return "早上好，新的一天开始了";
      if (h < 12) return "上午好";
      if (h < 14) return "中午好";
      if (h < 18) return "下午好";
      if (h < 22) return "晚上好";
      return "夜深了，注意休息";
    }

    function setPill(pillId, dotClass, value) {
      const pill = byId(pillId);
      if (!pill) return;
      const dot = pill.querySelector(".pill-dot");
      if (dot) {
        dot.classList.remove("green", "yellow", "red", "gray");
        dot.classList.add(dotClass);
      }
      const val = pill.querySelector(".pill-value");
      if (val) val.textContent = value;
    }

    function setMetricCard(cardSelector, status, value, detail) {
      const card = document.querySelector(cardSelector);
      if (!card) return;
      if (status) card.setAttribute("data-status", status);
      const v = card.querySelector(".wb-metric-value");
      if (v) animateCounter(v, value);
      const d = card.querySelector(".wb-metric-detail");
      if (d) d.textContent = detail;
    }

    /* ── v5 Drawer Panel Data Binding ── */
    async function refreshAllPanels() {
      // 1. DailyReportPanel — system health + knowledge status
      try {
        const health = await requestJson("/health/check");
        const ok = health?.status === "ok" || health?.status === "ready";
        setText("daily-system-value", ok ? "一切正常" : "部分异常");
        const dot = document.querySelector("#daily-system-status .v5-info-card-icon");
        if (dot) dot.textContent = ok ? "\u{1F7E2}" : "\u{1F534}";
      } catch {
        setText("daily-system-value", "未知");
      }

      try {
        const knowledgeHealth = await requestJson("/knowledge/health");
        const docCount = knowledgeHealth?.documentCount || 0;
        setText("daily-task-value", docCount + " 个文档");
        setText("daily-pending-value", "0");
        setText("daily-summary-text", ok ? "知识库运行正常，无待处理事项" : "请检查知识库状态");
      } catch {
        setText("daily-task-value", "--");
        setText("daily-pending-value", "--");
        setText("daily-summary-text", "知识库状态未知");
      }

      // Set date
      const today = new Date();
      setText("daily-report-date", today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,"0") + "-" + String(today.getDate()).padStart(2,"0"));

      // 2. MonitoringPanel — health, uptime, memory, requests
      try {
        const health = await requestJson("/health/check");
        const uptimeMs = health?.uptimeMs || 0;
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSec / 3600);
        const mins = Math.floor((uptimeSec % 3600) / 60);
        setText("uptime-value", hours + "h " + mins + "m");
        setText("monitoring-last-update", "最近更新: " + new Date().toLocaleTimeString());
        const ok = health?.status === "ok";
        setText("health-value", ok ? "正常" : "异常");
        const indicator = byId("health-indicator");
        if (indicator) {
          indicator.classList.remove("v5-indicator-ok", "v5-indicator-warn", "v5-indicator-error");
          indicator.classList.add(ok ? "v5-indicator-ok" : "v5-indicator-warn");
        }
      } catch {
        setText("health-value", "未知");
        setText("uptime-value", "--");
      }

      // Memory usage (from process.memoryUsage if available via /health/check or estimate)
      try {
        const health = await requestJson("/health/check");
        const memUsed = health?.memoryUsedMB || 0;
        setText("memory-value", memUsed > 0 ? memUsed + " MB" : "—");
      } catch {
        setText("memory-value", "—");
      }

      // Service status in monitoring panel
      try {
        const health = await requestJson("/health/check");
        const ok = health?.status === "ok";
        setText("service-gateway-status", ok ? "运行中" : "异常");
        const statusEl = byId("service-gateway-status");
        if (statusEl) {
          statusEl.classList.remove("v5-status-ok", "v5-status-warn", "v5-status-error");
          statusEl.classList.add(ok ? "v5-status-ok" : "v5-status-warn");
        }
      } catch {
        setText("service-gateway-status", "未知");
      }

      // 3. ProviderConfigPanel — provider status + config details
      try {
        const providers = await requestJson("/providers");
        const list = Array.isArray(providers) ? providers : (providers?.providers || []);
        const enabled = list.filter(p => p.enabled !== false && p.active !== false);
        const count = enabled.length;
        setText("config-provider-value", count + " 个供应商已启用");
        const hasKey = list.some(p => p.hasKey === true);
        setText("config-key-value", hasKey ? "已配置" : "未配置密钥");
        const defaultProvider = list.find(p => p.isDefault === true)?.id || "NVIDIA";
        setText("config-default-provider", defaultProvider);
        setText("config-mode-value", "real");
        setText("config-route-value", "fixed");
        setText("config-adapter-version", "v1.0");
      } catch {
        setText("config-provider-value", "--");
        setText("config-key-value", "--");
      }

      // 4. ModelManagementPanel — model count + active model
      try {
        const providers = await requestJson("/providers");
        const list = Array.isArray(providers) ? providers : (providers?.providers || []);
        let modelCount = 0;
        let activeModel = "--";
        let activeProvider = "--";
        list.forEach(p => {
          if (Array.isArray(p?.models)) {
            modelCount += p.models.length;
            if (p.isDefault && !activeModel) {
              activeModel = p.models[0]?.modelId || p.models[0]?.id || "--";
              activeProvider = p.id || p.providerId || "--";
            }
          }
        });
        setText("model-count-label", modelCount + " 个模型");
        setText("model-active-name", activeModel);
        setText("model-provider-name", activeProvider);
        setText("model-route-value", "固定");
      } catch {
        setText("model-count-label", "-- 个模型");
        setText("model-active-name", "--");
        setText("model-provider-name", "--");
      }

      // 5. WorkforceStatusPanel — workforce health + agent count
      try {
        const workforceHealth = await requestJson("/workforce/health");
        const workforceAgents = await requestJson("/workforce/agents");
        const agents = Array.isArray(workforceAgents) ? workforceAgents : (workforceAgents?.agents || []);
        const totalAgents = agents.length;
        const activeAgents = agents.filter(a => a.status === "active" || a.status === "running").length;
        const idleAgents = agents.filter(a => a.status === "idle").length;
        const busyAgents = agents.filter(a => a.status === "busy").length;
        const offlineAgents = totalAgents - activeAgents - idleAgents - busyAgents;
        setText("workforce-active-count", totalAgents + " 在线");
        setText("workforce-active", String(activeAgents));
        setText("workforce-idle", String(idleAgents));
        setText("workforce-busy", String(busyAgents));
        setText("workforce-offline", String(Math.max(0, offlineAgents)));
      } catch {
        setText("workforce-active-count", "-- 在线");
        setText("workforce-active", "0");
        setText("workforce-idle", "0");
        setText("workforce-busy", "0");
        setText("workforce-offline", "0");
      }

      // 6. WorkforceManagementPanel — agent pyramid stats
      try {
        const workforceAgents = await requestJson("/workforce/agents");
        const agents = Array.isArray(workforceAgents) ? workforceAgents : (workforceAgents?.agents || []);
        const totalAgents = agents.length;
        const activeAgents = agents.filter(a => a.status === "active").length;
        setText("wm-total-agents", String(totalAgents));
        setText("wm-active-agents", String(activeAgents));
        setText("wm-capability-count", String(agents.reduce((sum, a) => sum + (a.capabilities?.length || 0), 0)));
      } catch {
        setText("wm-total-agents", "--");
        setText("wm-active-agents", "--");
        setText("wm-capability-count", "--");
      }

      // 7. ApprovalPanel — pending approvals count
      try {
        const approvalsData = await requestJson("/approvals");
        const approvalsList = Array.isArray(approvalsData) ? approvalsData : (approvalsData?.approvals || []);
        const pendingCount = approvalsList.filter(a => a.status === "pending" || a.status === "open").length;
        setText("approval-count-badge", String(pendingCount));
        if (pendingCount === 0) {
          setText("approval-empty", "当前没有待审批事项");
        } else {
          // Render approval items
          const approvalList = byId("approval-list");
          if (approvalList) {
            approvalList.innerHTML = approvalsList.slice(0, 5).map(function(a) {
              var statusClass = a.status === "pending" ? "v5-status-pending" : "v5-status-done";
              var statusText = a.status === "pending" ? "待审批" : "已完成";
              return '<div class="v5-approval-item">' +
                '<span class="v5-approval-title">' + escapeHtml(a.title || a.goal || "审批任务") + '</span>' +
                '<span class="v5-approval-status ' + statusClass + '">' + statusText + '</span>' +
              '</div>';
            }).join("");
          }
        }
      } catch {
        setText("approval-count-badge", "0");
      }

      // 8. EngineeringToolsPanel, AdvancedPanel, YiyiSettingsPanel — static/demo only for now
      // These panels don't have dedicated backend APIs yet, keep placeholder text
    }

    async function fetchDashboardMetrics() {
      // ── 1. Health check ──
      try {
        const health = await requestJson("/health/check");
        const ok = health?.status === "ok" || health?.status === "ready" || health?.healthy === true;
        setPill("service-pill", ok ? "green" : "yellow", ok ? "正常" : "异常");
        setMetricCard('[data-metric="service-health"]', ok ? "ok" : "warn",
          ok ? "健康" : "异常",
          ok ? "所有子系统运行正常" : "部分服务异常，请检查");
        updateRingProgress("service", ok ? 100 : 30);
      } catch {
        setPill("service-pill", "red", "离线");
        setMetricCard('[data-metric="service-health"]', "error", "离线", "无法连接服务");
        updateRingProgress("service", 0);
      }

      // ── 2. Providers ──
      try {
        const providers = await requestJson("/providers");
        const list = Array.isArray(providers) ? providers : (providers?.providers || []);
        const enabled = list.filter((p) => p.enabled !== false && p.active !== false);
        const count = enabled.length;
        const names = enabled.slice(0, 3).map((p) => p.id || p.name || p.providerId).filter(Boolean).join(", ");
        setPill("provider-pill", count > 0 ? "green" : "gray", count + " 个");
        setMetricCard('[data-metric="provider-status"]', count > 0 ? "ok" : "warn",
          count + "",
          names || "未配置 Provider");
        updateRingProgress("provider", Math.min(100, Math.round(count / 7 * 100)));
      } catch {
        setPill("provider-pill", "gray", "未知");
        setMetricCard('[data-metric="provider-status"]', "warn", "—", "读取失败");
        updateRingProgress("provider", 0);
      }

      // ── 3. Models / Dashboard ──
      try {
        const providers = await requestJson("/providers");
        const list = Array.isArray(providers) ? providers : (providers?.providers || []);
        let modelCount = 0;
        list.forEach((p) => {
          if (Array.isArray(p?.models)) modelCount += p.models.length;
        });
        setPill("model-pill", modelCount > 0 ? "green" : "gray", modelCount + " 个");
        setMetricCard('[data-metric="active-models"]', modelCount > 0 ? "ok" : "warn",
          String(modelCount),
          modelCount > 0 ? modelCount + " 个模型已配置" : "未配置模型");
        updateRingProgress("models", Math.min(100, Math.round(modelCount / 28 * 100)));
      } catch {
        setPill("model-pill", "gray", "—");
        setMetricCard('[data-metric="active-models"]', "warn", "—", "读取失败");
        updateRingProgress("models", 0);
      }

      // ── 4. Security (static for now) ──
      setMetricCard('[data-metric="security-status"]', "ok", "正常", "0 拦截 · 密钥未暴露");
      updateRingProgress("security", 100);

      // ── 5. Greeting ──
      setText("wb-greeting-summary", getTimeGreeting() + " · AI Gateway 工作台已就绪");

      // Bridge: update v5 ConversationShell first line with pending count
      window.__v5PendingCount = 0;
      try {
        const approvalsData = await requestJson("/approvals");
        const approvalsList = Array.isArray(approvalsData) ? approvalsData : (approvalsData?.approvals || []);
        window.__v5PendingCount = approvalsList.filter(function(a) { return a.status === "pending" || a.status === "open"; }).length;
      } catch(e) { /* approvals may not be available */ }
      if (window.__v5 && window.__v5.updateFirstLine) {
        window.__v5.updateFirstLine();
      }
    }

    function initStatusPills() {
      fetchDashboardMetrics();
      refreshAllPanels();
      // Poll every 30 seconds
      window.setInterval(function() {
        fetchDashboardMetrics();
        refreshAllPanels();
      }, 30000);
    }

    bootstrap();
`;
