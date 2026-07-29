export const consolePageInlineJsPart04 = `      resultPanel.hidden = false;
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
      byId("model-page-current-selection").textContent = state.selectedModel || "未选择";
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
`;
