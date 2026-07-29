export const consolePageInlineJsPart05 = `        const failureReason = failedEvidence.reason || item.failureReason || item.selectableReason || "";
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
      badge.className = configured ? "inline-status ok" : "inline-status error";
      badge.textContent = configured ? "已配置（已隐藏）" : "未配置";
      byId("provider-key-summary").textContent = configured ? "已配置，页面不显示明文" : "未配置 API Key";
      byId("provider-test-summary").textContent = provider.lastTestResult?.message || "尚未测试";
      byId("provider-key-status-badge").textContent = configured ? "已配置（已隐藏）" : "未配置";
      const providerChip = byId("provider-chip");
      providerChip.textContent = "Provider：" + provider.keyStatus;
      providerChip.className = "status-chip";
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
      byId("diag-service-status").textContent = health.serviceStatus === "ready" ? "running" : (health.serviceStatus || "unknown");
      byId("diag-health-note").textContent = "/health/check: " + (health.routes?.chat ? "可用" : "待检查");
      byId("diag-provider-status").textContent = provider?.apiKeyConfigured ? "已配置" : "未配置";
      byId("diag-provider-note").textContent = provider?.lastTestResult?.message || (provider?.apiKeyConfigured ? "可进一步测试真实连接" : "未配置 API Key");
      byId("diag-model-count").textContent = String(chatModels);
      byId("diag-model-note").textContent = chatModels > 0 ? "仅统计已验证 Chat 模型" : "当前没有可直接聊天的模型";
      byId("diag-last-chat-output").textContent = state.lastChatResult
        ? prettyJson({
            selectedModel: state.lastChatResult.selectedModel,
            providerCalled: state.lastChatResult.providerCalled,
            completionVerified: state.lastChatResult.completionVerified,
            evidenceId: state.lastChatResult.evidenceId,
            summary: state.lastChatResult.userVisibleSummary
          })
        : "暂无记录。";
      byId("diag-last-error-output").textContent = state.lastError ? state.lastError : "暂无错误。";
      byId("diagnostics-raw-output").textContent = prettyJson({
        diagnostics: state.diagnostics,
        providerStatus: state.providerStatus,
        lastDryRunResult: state.lastDryRunResult,
        lastThreeModeResult: state.lastThreeModeResult
      });
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
`;
