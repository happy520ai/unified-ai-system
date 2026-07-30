export const consolePageInlineJsPart02 = `        ? "下一步看这里：" + taskText + "。"
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
      byId("yiyi-state-pill").textContent = state.yiyi.behavior;
      byId("yiyi-emotion-pill").textContent = state.yiyi.emotion;
      byId("yiyi-behavior-pill").textContent = state.yiyi.behavior;
      byId("yiyi-motion-pill").textContent = state.yiyi.motion;
      byId("yiyi-speech-bubble").textContent = state.yiyi.speech;
      byId("yiyi-emotion-copy").textContent = state.yiyi.emotion + ": " + state.yiyi.speech;
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
      const healthStatus = state.diagnostics?.health?.serviceStatus
        || state.diagnostics?.health?.status
        || "unknown";
      const provider = Array.isArray(state.providerStatus?.providers) ? state.providerStatus.providers[0] : null;
      const providerStatus = provider?.keyStatus || "unknown";
      byId("service-chip").textContent = "服务状态：" + (healthStatus === "ready" ? "可用" : healthStatus);
      byId("provider-chip").textContent = "模型连接：" + providerStatus;
      byId("model-chip").textContent = "当前模型：" + (state.selectedModel || "未选择");
      byId("chat-last-evidence").textContent = "最近 evidence：" + shortEvidenceId(state.lastChatResult?.evidenceId);
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
`;
