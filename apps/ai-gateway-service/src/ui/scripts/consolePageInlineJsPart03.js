export const consolePageInlineJsPart03 = `      const history = byId("chat-history");
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
        byId("evidence-output").textContent = prettyJson({ threeModeRuntime: threeMode });
        return;
      }
      if (state.sampleDryRunStarted) {
        byId("evidence-output").textContent = prettyJson({
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
        });
        return;
      }
      const result = state.lastChatResult;
      const dryRun = state.lastDryRunResult;
      const source = result || dryRun;
      if (!source) {
        byId("evidence-output").textContent = prettyJson({
          sampleDryRunAvailable: true,
          message: "No real execution details yet. Use Start sample dry-run to view a local Mission Control trace.",
          providerCallsMade: false,
          secretValueExposed: false,
          productionAction: false,
          costAction: false,
          invoiceAction: false
        });
        return;
      }
      byId("evidence-output").textContent = prettyJson({
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
      });
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
      byId("evidence-backdrop").classList.add("is-open");
      byId("evidence-drawer").classList.add("is-open");
      byId("evidence-drawer").setAttribute("aria-hidden", "false");
    }

    function closeEvidenceDrawer() {
      byId("evidence-backdrop").classList.remove("is-open");
      byId("evidence-drawer").classList.remove("is-open");
      byId("evidence-drawer").setAttribute("aria-hidden", "true");
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
`;
