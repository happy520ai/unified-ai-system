import { renderConversationShell } from "./components/v5/ConversationShell.js";
import { conversationShellClientJs } from "./scripts/conversationShellClientJs.js";
import { cardTransitionClientJs } from "./lib/cardTransition.js";
import { ownerDesignTokensCss } from "./styles/ownerDesignTokens.js";
import { ownerOsThemeCss } from "./styles/ownerOsTheme.js";
import { workbenchCoreCss } from "./styles/workbenchCoreCss.js";
import { consolePageInlineCss } from "./styles/consolePageInlineCss.js";
import { consolePageInlineJs } from "./scripts/consolePageInlineJs.js";
import { pageSwitcherClientJs } from "./scripts/pageSwitcherClientJs.js";

export function createPhase321AWorkbenchPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Gateway Workbench</title>
  <style>
${workbenchCoreCss}
${ownerDesignTokensCss}
${ownerOsThemeCss}
${consolePageInlineCss}
  </style>
</head>
<body data-phase="phase321a-workbench-product-recovery">
  <div class="app" data-workbench-root="phase372-workbench-root" data-phase="phase372-guarded-ui-acceptance">
    <nav class="nav-bar">
      <div class="nav-brand">
        <div class="brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <span class="brand-label">AI Gateway</span>
      </div>
      <div class="nav-cards" role="tablist" aria-label="主导航">
        <button type="button" class="nav-card is-active" data-nav="chat" data-card-idx="0" role="tab" aria-selected="true">
          <svg class="card-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>
          <span class="card-label">总控台</span>
        </button>
        <button type="button" class="nav-card" data-nav="models" data-card-idx="1" role="tab" aria-selected="false">
          <svg class="card-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2l7 4v8l-7 4-7-4V6l7-4z"/><path d="M10 18V10"/><path d="M17 6l-7 4-7-4"/></svg>
          <span class="card-label">模型</span>
        </button>
        <button type="button" class="nav-card" data-nav="approvals" data-card-idx="2" role="tab" aria-selected="false">
          <svg class="card-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 3h10a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M7 8h6M7 12h6M7 16h3"/></svg>
          <span class="card-label">任务</span>
        </button>
        <button type="button" class="nav-card" data-nav="files" data-card-idx="3" role="tab" aria-selected="false">
          <svg class="card-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2a5 5 0 015 5v4a5 5 0 01-10 0V7a5 5 0 015-5z"/><path d="M10 14v4"/><path d="M7 18h6"/></svg>
          <span class="card-label">安全</span>
        </button>
        <button type="button" class="nav-card" data-nav="diagnostics" data-card-idx="4" role="tab" aria-selected="false">
          <svg class="card-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.2 4.2l2.1 2.1M13.7 13.7l2.1 2.1M4.2 15.8l2.1-2.1M13.7 6.3l2.1-2.1"/></svg>
          <span class="card-label">设置</span>
        </button>
      </div>
      <div class="nav-search">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>
          <input type="text" class="search-input" id="global-search-input" placeholder="搜索工具、模型、文件或联网..." autocomplete="off" aria-label="搜索工具、模型、文件或联网" />
          <kbd class="search-kbd">/</kbd>
        </div>
        <div class="search-dropdown" id="search-dropdown" hidden>
          <div class="search-results" id="search-results"></div>
        </div>
      </div>
      <div class="topbar-status">
        <div class="status-pill" id="service-pill" role="status" aria-live="polite">
          <span class="pill-dot gray"></span>
          <span class="pill-label">服务</span>
          <span class="pill-value" id="service-chip-value">检测中</span>
        </div>
        <div class="status-pill" id="provider-pill" role="status" aria-live="polite">
          <span class="pill-dot gray"></span>
          <span class="pill-label">Provider</span>
          <span class="pill-value" id="provider-chip-value">检测中</span>
        </div>
        <div class="status-pill" id="model-pill" role="status" aria-live="polite">
          <span class="pill-dot gray"></span>
          <span class="pill-label">模型</span>
          <span class="pill-value" id="model-chip-value">检测中</span>
        </div>
        <button type="button" class="topbar-refresh" id="refresh-status-btn" title="刷新状态" aria-label="刷新所有状态">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 8a7 7 0 0112.5-4.3M15 8a7 7 0 01-12.5 4.3"/><path d="M13.5 1v3h-3M2.5 15v-3h3"/></svg>
        </button>
      </div>
    </nav>
    <div class="main-shell">
      <div class="page-title-strip">
        <h1 id="page-title">总控台</h1>
        <span class="page-title-copy">AI Gateway Workbench · 本地动作可执行，模型调用受控</span>
      </div>
      <section class="workspace">
        <section class="page is-active" data-page="chat">
          <div class="chat-page">
${renderConversationShell()}
          </div>
        </section>

        <section class="page" data-page="models">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2 data-model-library-entry="true"><span class="icon-spacer">&#9881;</span>模型配置</h2>
                  <div class="card-copy">三步完成配置：选择 Provider → 粘贴 API Key → 自动检测并选择模型</div>
                </div>
                <span class="inline-status" id="provider-key-status-badge"><span class="loading-text">读取中</span></span>
              </div>

              <!-- Step 1: Select Provider -->
              <div class="field mt-md">
                <label for="provider-select-input">1. 选择 Provider</label>
                <select id="provider-select-input">
                  <option value="">-- 请选择 --</option>
                </select>
              </div>

              <!-- Step 2: Enter API Key -->
              <div class="field mt-md">
                <label for="provider-api-key-input">2. 粘贴 API Key</label>
                <input id="provider-api-key-input" type="password" autocomplete="off" placeholder="例如：nvapi-xxx 或 sk-xxx">
              </div>

              <!-- Step 3: Auto-detect Models -->
              <div class="mt-md" id="model-detection-area" style="display:none;">
                <div class="surface-muted" style="padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-3);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span><strong>3. 可用模型</strong></span>
                    <button type="button" id="detect-models-button" class="secondary" style="font-size: var(--text-caption); padding: 4px 12px;">重新检测</button>
                  </div>
                </div>
                <div class="field">
                  <label for="model-select-input">选择模型</label>
                  <select id="model-select-input">
                    <option value="">-- 请先检测 --</option>
                  </select>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="model-actions mt-md">
                <button type="button" class="primary" id="save-provider-button" disabled>保存并设为默认</button>
                <button type="button" id="test-provider-button">测试连接</button>
              </div>

              <!-- Status Display -->
              <div class="surface-muted mt-md">
                <div class="kv-list">
                  <div><span>当前模型</span><strong id="model-page-current-selection"><span class="loading-text">未配置</span></strong></div>
                  <div><span>API Key 状态</span><strong id="provider-key-summary"><span class="loading-text">读取中</span></strong></div>
                  <div><span>最近测试</span><strong id="provider-test-summary"><span class="loading-text loading-static">尚未测试</span></strong></div>
                </div>
              </div>

            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3><span class="icon-spacer">&#128172;</span>可用于普通 Chat 的模型</h3>
                  <div class="card-copy">这里只展示已验证、可选择、允许直接 Chat 的模型。任务工具模型或未验证模型会保留说明，但不会混入普通聊天下拉。</div>
                </div>
              </div>
              <div class="surface-muted mb-md" id="model-library-status-summary"><span class="loading-text">Loading model status...</span></div>
              <div class="grid-two mb-md">
                <div class="field">
                  <label for="model-library-search-input">Model search</label>
                  <input id="model-library-search-input" placeholder="modelId / providerId / evidenceId / capability / failureReason">
                </div>
                <div class="field">
                  <label for="model-library-sort-select">Sort</label>
                  <select id="model-library-sort-select">
                    <option value="default">default</option>
                    <option value="model_asc">modelId asc</option>
                    <option value="status">status</option>
                    <option value="latency_asc">latency asc</option>
                    <option value="latency_desc">latency desc</option>
                    <option value="selectable_first">selectable first</option>
                    <option value="evidence_first">evidence present first</option>
                    <option value="verified_desc">lastVerifiedAt</option>
                  </select>
                </div>
              </div>
              <div class="grid-two mb-md">
                <div class="field">
                  <label for="model-library-status-filter">Status filter</label>
                  <select id="model-library-status-filter">
                    <option value="all">all</option>
                    <option value="selectable">selectable</option>
                    <option value="smoke_passed">smoke_passed</option>
                    <option value="failed">failed</option>
                    <option value="unverified">unverified</option>
                    <option value="high_latency">high_latency</option>
                  </select>
                </div>
                <div class="field">
                  <label for="model-library-provider-filter">Provider scope</label>
                  <select id="model-library-provider-filter">
                    <option value="all">all</option>
                    <option value="nvidia-enabled">nvidia-enabled</option>
                    <option value="future-provider-slot">future-provider-slot</option>
                  </select>
                </div>
              </div>
              <div class="grid-two mb-md">
                <div class="field">
                  <label for="model-library-capability-filter">Capability filter</label>
                  <select id="model-library-capability-filter">
                    <option value="all">all</option>
                    <option value="chat_like">chat / reasoning_chat / instruct</option>
                    <option value="unknown">unknown</option>
                    <option value="non_chat">non-chat</option>
                  </select>
                </div>
                <div class="field">
                  <label>Current filter stats</label>
                  <div class="surface-muted" id="model-library-filter-stats"><span class="loading-text">Loading filter stats...</span></div>
                </div>
              </div>
              <div class="model-list" id="model-list-output"></div>
              <div class="surface-muted mt-md" id="model-library-strategy-summary"><span class="loading-text">Loading strategy...</span></div>
              <div class="model-list" id="model-library-strategy-output"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="approvals">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2><span class="icon-spacer">&#128203;</span>审批任务</h2>
                  <div class="card-copy">测试审批任务只会生成受限 no-op patch proposal。未批准前不会执行；批准后也只能在 allowedFiles 范围内做安全动作。</div>
                </div>
                <span class="inline-status warn">需要人工审批</span>
              </div>
              <div class="approval-actions">
                <button type="button" class="primary" id="create-approval-button">创建测试审批任务</button>
                <button type="button" id="refresh-approvals-button">刷新状态</button>
                <button type="button" id="preview-approval-intent-button">只读预览审批意图</button>
                <button type="button" data-open-page="local-agent">去本地智能体工作台</button>
              </div>
              <div class="text-block" id="approval-preview-output"><span class="placeholder-text">当前尚未运行审批意图预览。该入口只调用只读预览，不创建审批，不生成 patch proposal，也不执行本地动作。</span></div>
            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3><span class="icon-spacer">&#128221;</span>审批队列</h3>
                  <div class="card-copy">这里不提供危险放权、代码提交或对外发布入口，只允许审批、拒绝、执行已批准的安全动作。</div>
                </div>
              </div>
              <div id="approval-list" class="model-list"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="files">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2><span class="icon-spacer">&#128274;</span>文件登记</h2>
                  <div class="card-copy">当前只做文件登记与预览，不进入知识库训练，不触发 embedding batch training，也不会调用 paid API。</div>
                </div>
                <span class="inline-status warn">仅登记 / 预览</span>
              </div>
              <div class="file-actions">
                <button type="button" class="primary" id="pick-file-button">选择文件</button>
                <button type="button" id="refresh-files-button">刷新列表</button>
                <button type="button" data-open-page="repair">进入安全修复入口</button>
              </div>
              <input id="file-input" type="file" multiple class="sr-only">
              <div class="text-block" id="file-summary-output"><span class="placeholder-text">尚未登记文件。敏感文件名（如 .env、secret、token）会被拦截。</span></div>
            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3><span class="icon-spacer">&#128193;</span>最近登记结果</h3>
                  <div class="card-copy">如果文件只是登记成功，这里会明确写出"仅登记 / 预览，未进入知识库训练"。</div>
                </div>
              </div>
              <div id="file-list-output" class="model-list"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="diagnostics">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2><span class="icon-spacer">&#128200;</span>诊断中心</h2>
                  <div class="card-copy">这里只展示用户能看懂的状态。更细的 evidence 放在折叠区和详情抽屉里，不抢占主流程。</div>
                </div>
              </div>
              <div class="diagnostic-actions">
                <button type="button" class="primary" id="refresh-diagnostics-button">刷新状态</button>
                <button type="button" id="run-dry-run-button">运行测试模式</button>
                <button type="button" data-open-page="help">查看使用帮助</button>
              </div>
              <div class="grid-three mt-md">
                <div class="stat-card" style="--accent-color:#34c759;">
                  <div class="stat-label">服务状态</div>
                  <div class="stat-value" id="diag-service-status"><span class="loading-text">读取中</span></div>
                  <div class="card-copy" id="diag-health-note">等待 /health</div>
                </div>
                <div class="stat-card" style="--accent-color:#ff9500;">
                  <div class="stat-label">Provider 配置</div>
                  <div class="stat-value" id="diag-provider-status"><span class="loading-text">读取中</span></div>
                  <div class="card-copy" id="diag-provider-note">等待 Provider 状态</div>
                </div>
                <div class="stat-card" style="--accent-color:#007aff;">
                  <div class="stat-label">可用 Chat 模型数</div>
                  <div class="stat-value" id="diag-model-count">0</div>
                  <div class="card-copy" id="diag-model-note">等待模型库</div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>最近一次 Chat 请求</h3>
                  <div class="text-block" id="diag-last-chat-output"><span class="placeholder-text">暂无记录。</span></div>
                </div>
                <div>
                  <h3>最近一次错误</h3>
                  <div class="text-block" id="diag-last-error-output"><span class="placeholder-text">暂无错误。</span></div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-three">
                <div class="diagnostic-item">
                  <strong>real_enabled</strong>
                  <div class="card-copy">表示当前动作可以直接运行，例如聊天发送、模型配置保存和状态读取。</div>
                </div>
                <div class="diagnostic-item">
                  <strong>approval_required</strong>
                  <div class="card-copy">表示动作必须先进入审批链；未批准前不会执行本地操作。</div>
                </div>
                <div class="diagnostic-item">
                  <strong>blocked_by_policy</strong>
                  <div class="card-copy">表示当前阶段明确禁止该动作，例如读取 secret、危险放权、代码提交或对外发布。</div>
                </div>
              </div>
              <details class="mt-md">
                <summary>展开高级诊断详情</summary>
                <div class="text-block mt-md" id="diagnostics-raw-output">等待诊断结果。</div>
              </details>
            </section>
          </div>
        </section>

        <section class="page" data-page="local-agent">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2><span class="icon-spacer">&#129302;</span>本地智能体工作台</h2>
                  <div class="card-copy">这里只调用现有 local-agent 预览、计划、patch proposal 和审批创建路由。不会直接 apply，也不会调用外部 Provider。</div>
                </div>
                <span class="inline-status warn">approval_required</span>
              </div>
              <label for="local-agent-task-input"><strong>任务说明</strong></label>
              <textarea id="local-agent-task-input" class="text-input" rows="6" placeholder="例如：修复 Workbench 某个按钮不可点，限定只改某个 UI 文件。"></textarea>
              <label for="local-agent-allowed-files-input"><strong>allowedFiles</strong></label>
              <textarea id="local-agent-allowed-files-input" class="text-input" rows="3" placeholder="每行一个相对路径，例如 apps/ai-gateway-service/src/ui/consolePage.js"></textarea>
              <div class="approval-actions">
                <button type="button" class="primary" id="local-agent-preview-button">意图预览</button>
                <button type="button" id="local-agent-plan-button">生成操作计划</button>
                <button type="button" id="local-agent-patch-button">生成 patch proposal</button>
                <button type="button" id="local-agent-create-approval-button">创建审批记录</button>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>意图预览</h3>
                  <div class="text-block" id="local-agent-intent-output"><span class="placeholder-text">尚未运行意图预览。</span></div>
                </div>
                <div>
                  <h3>操作计划</h3>
                  <div class="text-block" id="local-agent-plan-output"><span class="placeholder-text">尚未生成操作计划。</span></div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>Patch Proposal</h3>
                  <div class="text-block" id="local-agent-patch-output"><span class="placeholder-text">尚未生成 patch proposal。</span></div>
                </div>
                <div>
                  <h3>审批创建结果</h3>
                  <div class="text-block" id="local-agent-approval-output"><span class="placeholder-text">尚未创建审批记录。</span></div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section class="page" data-page="repair">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2><span class="icon-spacer">&#128736;</span>安全修复入口</h2>
                  <div class="card-copy">这里不是直接修文件的执行器。它只把修复任务整理成受限输入，再送到本地智能体页面继续做意图预览、计划和审批。</div>
                </div>
                <span class="inline-status warn">dry-run only</span>
              </div>
              <label for="repair-task-input"><strong>修复目标</strong></label>
              <textarea id="repair-task-input" class="text-input" rows="5" placeholder="例如：补齐缺失页面、修复某个死按钮、限定只改指定文件。"></textarea>
              <label for="repair-allowed-files-input"><strong>允许修改的文件</strong></label>
              <textarea id="repair-allowed-files-input" class="text-input" rows="3" placeholder="每行一个相对路径"></textarea>
              <div class="approval-actions">
                <button type="button" class="primary" id="repair-open-local-agent-button" data-open-page="local-agent">带着修复任务进入本地智能体</button>
              </div>
              <div class="text-block">边界：不直接应用补丁，不做代码提交，不做远程推送，不做部署，不做发布；只做受限 repair draft 预填。</div>
            </section>
          </div>
        </section>

        <section class="page" data-page="help">
          <div class="page-shell">
            <section class="card" id="help-runbook-panel">
              <div class="card-head">
                <div>
                  <h2>&#10067; 使用帮助</h2>
                  <div class="card-copy">这里讲清楚当前系统能做什么、不能做什么，以及出错时应该去哪一页继续处理。</div>
                </div>
              </div>
              <div class="grid-two">
                <div class="text-block">聊天：默认走现有 Chat Gateway。若 providerCalled=false，会明确告诉你没有浪费模型请求。</div>
                <div class="text-block">模型：普通聊天下拉只显示 smoke_passed + selectable + directChatAllowed 的可用模型。</div>
                <div class="text-block">本地智能体：只做意图预览、操作计划、patch proposal 和审批创建；真正 apply 仍受审批链约束。</div>
                <div class="text-block">安全修复：先在修复入口整理目标，再带着 allowedFiles 进入本地智能体，不直接做危险动作。</div>
                <div class="text-block">审批链：未批准前不会执行本地动作；已批准后也只能在 allowedFiles 范围内做安全动作。</div>
                <div class="text-block">策略阻断：读取 secret、打印 API Key、代码提交、远程推送、部署、发布、付费 API 调用默认都被阻断。</div>
              </div>
              <div class="approval-actions mt-md">
                <button type="button" class="primary" id="help-open-local-agent-button" data-open-page="local-agent">去本地智能体</button>
                <button type="button" id="help-open-diagnostics-button" data-open-page="diagnostics">去诊断中心</button>
              </div>
            </section>
          </div>
        </section>
      </section>
    </div>
  </div>

  <div class="drawer-backdrop" id="evidence-backdrop"></div>
  <aside class="drawer" id="evidence-drawer" aria-hidden="true">
    <div class="card-head">
      <div>
        <h3>执行详情</h3>
        <div class="card-copy">这里展示最近一次聊天或三模式执行的模型、Provider 调用状态、完成校验和 evidenceId。</div>
      </div>
      <button type="button" class="ghost" id="close-evidence-button">关闭</button>
    </div>
    <div class="text-block" id="evidence-output">尚无执行详情。</div>
  </aside>
  <div class="toast" id="toast" role="alert" aria-live="assertive"></div>
  <div class="sr-only" aria-hidden="true" id="phase321a-compat-markers">
    <span id="phase313a-single-safe-chat-copy">当前普通 Chat 只显示已验证、可选择、允许直接 Chat 的模型。</span>
    <span id="phase313a-status-filter" data-testid="ui-filters-present">兼容状态筛选标记</span>
    <span id="phase313a-bucket-filter">兼容能力桶筛选标记</span>
    <button type="button" id="phase313a-generate-verification-plan">生成验证计划</button>
    <span id="phase319a-current-page-model-marker">phase321a-current-page-model / phase319a-current-page-model</span>
    <span id="phase319a-compat-routes">/local-agent/intent-preview /local-agent/operation-plan /plugin-registry</span>
  </div>

  <script>${consolePageInlineJs}</script>
  <script>${conversationShellClientJs}</script>
<script>${cardTransitionClientJs}</script>
  <script>${pageSwitcherClientJs}</script>
</body>
</html>`;
}

export function stripCharacterUiForMissionControl(html) {
  let next = html;
  const blockPatterns = [
    /<section class="yiyi-live-avatar-stage"[\s\S]*?<\/section>/g,
    /<section class="yiyi-avatar-layer"[\s\S]*?<\/section>/g,
    /<section class="yiyi-guided-showcase"[\s\S]*?<\/section>/g,
    /<section class="yiyi-emotion-panel"[\s\S]*?<\/section>/g,
  ];
  for (const pattern of blockPatterns) next = next.replace(pattern, "");
  return next;
}
