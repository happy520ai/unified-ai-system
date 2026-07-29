export const consolePageInlineJsPart07 = `        return;
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

    byId("chat-form").addEventListener("submit", sendChat);
    byId("model-select").addEventListener("change", (event) => {
      state.selectedModel = event.target.value;
      saveSelectedModel();
      renderTopbar(); renderThreeModeControls();
      byId("model-page-current-selection").textContent = state.selectedModel || "未选择";
    });
    byId("three-mode-tianshu-input")?.addEventListener("input", (event) => {
      byId("three-mode-task-preview").textContent = "taskClassification: " + classifyTaskPreview(event.target.value);
    });
    byId("owner-task-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        handleOwnerTaskInputSubmit();
      }
    });
      byId("file-input").addEventListener("change", (event) => {
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

    bootstrap();
`;
