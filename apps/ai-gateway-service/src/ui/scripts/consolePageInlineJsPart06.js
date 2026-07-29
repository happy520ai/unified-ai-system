export const consolePageInlineJsPart06 = `      if (code === "provider_not_allowed_phase312a" || code === "real_provider_disabled" || blockerCodes.includes("real_provider_disabled")) {
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
      const payload = {
        providerId: "nvidia",
        baseUrl: byId("provider-base-url-input").value.trim(),
        apiKey: byId("provider-api-key-input").value.trim()
      };
      const result = await workbenchApiClient.saveProviderConfig(payload);
      byId("provider-api-key-input").value = "";
      await loadProviderStatus();
      renderDiagnostics();
      showToast(result.success ? "配置已保存，页面不会回显 API Key 明文。" : (result.message || "保存失败。"), result.success ? "info" : "warn");
    }

    async function testProviderConfig() {
      const result = await workbenchApiClient.testProviderConfig({
        providerId: "nvidia",
        modelId: state.selectedModel
      });
      state.lastError = result.success ? null : (result.message || "Provider 测试失败");
      await loadProviderStatus();
      renderDiagnostics();
      showToast(result.realExternalCall ? "已执行真实连接测试。" : (result.message || "测试未发生真实外呼。"), result.success ? "info" : "warn");
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
      try {
        await refreshAll();
      } catch (error) {
        state.lastError = error.message;
        renderDiagnostics();
        showToast("初始化失败：" + error.message, "error");
      }
    }

    document.addEventListener("click", async (event) => {
      const ownerBossAction = event.target.closest("[data-owner-boss-action]");
      if (ownerBossAction) {
        handleOwnerBossViewAction(ownerBossAction.getAttribute("data-owner-boss-action"));
        return;
      }
      if (event.target.closest("#future-os-preview-button")) {
        previewFutureMinimalOsPlan();
`;
