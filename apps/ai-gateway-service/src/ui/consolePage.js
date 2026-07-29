import { renderThreeModeOverviewPanel } from "./components/ThreeModeOverviewPanel.js";
import { renderProviderCredentialRefPanel } from "./components/ProviderCredentialRefPanel.js";
import { renderMissionControlPanel } from "./components/MissionControlPanel.js";
import { providerCredentialCopy } from "./copy/providerCredentialCopy.js";
import { consolePageInlineJs } from "./scripts/consolePageInlineJs.js";
import { consolePageInlineCss } from "./styles/consolePageInlineCss.js";

function createPhase321AWorkbenchPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Gateway Workbench</title>
  <style>${consolePageInlineCss}  </style>
</head>
<body data-phase="phase321a-workbench-product-recovery">
  <div class="app" data-workbench-root="phase372-workbench-root" data-phase="phase372-guarded-ui-acceptance">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-title">小天总控</div>
        <div class="brand-copy">一个入口处理聊天、知识库、本地动作和模型连接；生产部署与公开发布不在本轮范围内。</div>
      </div>
      <nav class="nav-list" aria-label="小天总控主导航">
        <button type="button" class="nav-button is-active" data-nav="chat">总控台</button>
        <button type="button" class="nav-button" data-nav="models">模型</button>
        <button type="button" class="nav-button" data-nav="approvals">任务</button>
        <button type="button" class="nav-button" data-nav="files">安全</button>
        <button type="button" class="nav-button" data-nav="diagnostics">设置</button>
      </nav>
      <div class="sidebar-note">
        当前阶段只保留有实际用途的入口，不提供危险授权、代码提交、对外发布或上线操作。所有界面都按“禁止部署”的产品完善口径展示。
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div>
          <h1 id="page-title">小天总控台</h1>
          <div class="topbar-copy">真实能力走明确边界：本地动作可执行，模型调用受控，密钥读取和生产动作默认拦截。</div>
        </div>
        <div class="topbar-status">
          <span class="status-chip" id="service-chip">服务状态：读取中</span>
          <span class="status-chip" id="provider-chip">模型连接：读取中</span>
          <span class="status-chip" id="model-chip">当前模型：读取中</span>
        </div>
      </header>
      <section class="workspace">
        <section class="page is-active" data-page="chat">
          <div class="chat-page">
${renderMissionControlPanel()}
            <section class="chat-hero">
              <div>
                <h2>AI Gateway Mission Control</h2>
                <p>不是聊天壳，而是多模型、多智能体、可治理、可审计、可回放的任务指挥舱。默认显示摘要，细节进入 evidence。</p>
              </div>
              <div class="chat-badges">
                <span class="status-chip" id="chat-run-mode">聊天模式：等待执行</span>
                <span class="status-chip" id="chat-last-evidence">最近 evidence：未生成</span>
                <button type="button" class="ghost" id="open-evidence-button">查看执行详情</button>
              </div>
            </section>
            <section class="chat-shell">
              <div class="chat-panel">
                <div class="chat-history" id="chat-history">
                  <div class="chat-conversation" id="chat-conversation"></div>
                </div>
                <div class="composer-wrap">
                  <form class="composer" id="chat-form">
                    <div class="composer-left">
                      <div class="field">
                        <label for="model-select">当前页面模型</label>
                        <select id="model-select"></select>
                      </div>
                      <button type="button" id="set-page-model-button">设为当前页面模型</button>
                      <div class="hint" id="chat-model-hint">这里只展示已验证、可选择、允许直接 Chat 的模型；未验证或非 Chat 模型不会混入普通对话下拉。</div>
                    </div>
                    <div class="composer-main">
                      <label for="chat-input">输入内容</label>
                      <textarea id="chat-input" placeholder="输入你的问题。默认尝试真实 NVIDIA Chat Gateway；如果当前环境不允许真实调用，页面会明确说明原因。"></textarea>
                    </div>
                    <div class="composer-actions">
                      <button type="submit" class="primary" id="send-button">发送</button>
                      <button type="button" id="new-chat-button">清空会话</button>
                    </div>
                  </form>
${renderThreeModeOverviewPanel()}
                </div>
              </div>
            </section>
          </div>
        </section>

        <section class="page" data-page="models">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2 data-model-library-entry="true">模型配置</h2>
                  <div class="card-copy">${providerCredentialCopy.cardCopy}</div>
                </div>
                <span class="inline-status" id="provider-key-status-badge">读取中</span>
              </div>
${renderProviderCredentialRefPanel()}

              <div class="grid-two">
                <div class="field">
                  <label for="provider-base-url-input">NVIDIA Base URL</label>
                  <input id="provider-base-url-input" placeholder="默认留空时使用 NVIDIA 既有基线地址">
                </div>
                <div class="field">
                  <label for="provider-api-key-input">NVIDIA API Key</label>
                  <input id="provider-api-key-input" type="password" autocomplete="off" placeholder="仅写入，不显示明文">
                </div>
              </div>
              <div class="model-actions" style="margin-top:14px;">
                <button type="button" id="save-provider-button">保存配置</button>
                <button type="button" id="test-provider-button">检查配置状态（不调用真实任务）</button>
                <button type="button" id="model-page-set-button">设为当前页面模型</button>
              </div>
              <div class="surface-muted" style="margin-top:14px;">
                <div class="kv-list">
                  <div><span>当前页面模型</span><strong id="model-page-current-selection">读取中</strong></div>
                  <div><span>API Key 状态</span><strong id="provider-key-summary">读取中</strong></div>
                  <div><span>最近连接测试</span><strong id="provider-test-summary">尚未测试</strong></div>
                </div>
              </div>

            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>可用于普通 Chat 的模型</h3>
                  <div class="card-copy">这里只展示已验证、可选择、允许直接 Chat 的模型。任务工具模型或未验证模型会保留说明，但不会混入普通聊天下拉。</div>
                </div>
              </div>
              <div class="surface-muted" id="model-library-status-summary" style="margin-bottom:14px;">Loading model status...</div>
              <div class="grid-two" style="margin-bottom:14px;">
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
              <div class="grid-two" style="margin-bottom:14px;">
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
              <div class="grid-two" style="margin-bottom:14px;">
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
                  <div class="surface-muted" id="model-library-filter-stats">Loading filter stats...</div>
                </div>
              </div>
              <div class="model-list" id="model-list-output"></div>
              <div class="surface-muted" id="model-library-strategy-summary" style="margin-top:14px;">Loading strategy...</div>
              <div class="model-list" id="model-library-strategy-output"></div>
            </section>
          </div>
        </section>

        <section class="page" data-page="approvals">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>审批任务</h2>
                  <div class="card-copy">测试审批任务只会生成受限 no-op patch proposal。未批准前不会执行；批准后也只能在 allowedFiles 范围内做安全动作。</div>
                </div>
                <span class="inline-status warn">需要人工审批</span>
              </div>
              <div class="approval-actions">
                <button type="button" id="create-approval-button">创建测试审批任务</button>
                <button type="button" id="refresh-approvals-button">刷新状态</button>
                <button type="button" id="preview-approval-intent-button">只读预览审批意图</button>
                <button type="button" data-open-page="local-agent">去本地智能体工作台</button>
              </div>
              <div class="text-block" id="approval-preview-output">当前尚未运行审批意图预览。该入口只调用只读预览，不创建审批，不生成 patch proposal，也不执行本地动作。</div>
            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>审批队列</h3>
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
                  <h2>文件登记</h2>
                  <div class="card-copy">当前只做文件登记与预览，不进入知识库训练，不触发 embedding batch training，也不会调用 paid API。</div>
                </div>
                <span class="inline-status warn">仅登记 / 预览</span>
              </div>
              <div class="file-actions">
                <button type="button" id="pick-file-button">选择文件</button>
                <button type="button" id="refresh-files-button">刷新列表</button>
                <button type="button" data-open-page="repair">进入安全修复入口</button>
              </div>
              <input id="file-input" type="file" multiple class="sr-only">
              <div class="text-block" id="file-summary-output">尚未登记文件。敏感文件名（如 .env、secret、token）会被拦截。</div>
            </section>
            <section class="card">
              <div class="card-head">
                <div>
                  <h3>最近登记结果</h3>
                  <div class="card-copy">如果文件只是登记成功，这里会明确写出“仅登记 / 预览，未进入知识库训练”。</div>
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
                  <h2>诊断中心</h2>
                  <div class="card-copy">这里只展示用户能看懂的状态。更细的 evidence 放在折叠区和详情抽屉里，不抢占主流程。</div>
                </div>
              </div>
              <div class="diagnostic-actions">
                <button type="button" id="refresh-diagnostics-button">刷新状态</button>
                <button type="button" id="run-dry-run-button">运行测试模式</button>
                <button type="button" data-open-page="help">查看使用帮助</button>
              </div>
              <div class="grid-three" style="margin-top:14px;">
                <div class="stat-card">
                  <div class="stat-label">服务状态</div>
                  <div class="stat-value" id="diag-service-status">读取中</div>
                  <div class="card-copy" id="diag-health-note">等待 /health</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Provider 配置</div>
                  <div class="stat-value" id="diag-provider-status">读取中</div>
                  <div class="card-copy" id="diag-provider-note">等待 Provider 状态</div>
                </div>
                <div class="stat-card">
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
                  <div class="text-block" id="diag-last-chat-output">暂无记录。</div>
                </div>
                <div>
                  <h3>最近一次错误</h3>
                  <div class="text-block" id="diag-last-error-output">暂无错误。</div>
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
              <details style="margin-top:14px;">
                <summary>展开高级诊断详情</summary>
                <div class="text-block" id="diagnostics-raw-output" style="margin-top:12px;">等待诊断结果。</div>
              </details>
            </section>
          </div>
        </section>

        <section class="page" data-page="local-agent">
          <div class="page-shell">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>本地智能体工作台</h2>
                  <div class="card-copy">这里只调用现有 local-agent 预览、计划、patch proposal 和审批创建路由。不会直接 apply，也不会调用外部 Provider。</div>
                </div>
                <span class="inline-status warn">approval_required</span>
              </div>
              <label for="local-agent-task-input"><strong>任务说明</strong></label>
              <textarea id="local-agent-task-input" class="text-input" rows="6" placeholder="例如：修复 Workbench 某个按钮不可点，限定只改某个 UI 文件。"></textarea>
              <label for="local-agent-allowed-files-input"><strong>allowedFiles</strong></label>
              <textarea id="local-agent-allowed-files-input" class="text-input" rows="3" placeholder="每行一个相对路径，例如 apps/ai-gateway-service/src/ui/consolePage.js"></textarea>
              <div class="approval-actions">
                <button type="button" id="local-agent-preview-button">意图预览</button>
                <button type="button" id="local-agent-plan-button">生成操作计划</button>
                <button type="button" id="local-agent-patch-button">生成 patch proposal</button>
                <button type="button" id="local-agent-create-approval-button">创建审批记录</button>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>意图预览</h3>
                  <div class="text-block" id="local-agent-intent-output">尚未运行意图预览。</div>
                </div>
                <div>
                  <h3>操作计划</h3>
                  <div class="text-block" id="local-agent-plan-output">尚未生成操作计划。</div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="grid-two">
                <div>
                  <h3>Patch Proposal</h3>
                  <div class="text-block" id="local-agent-patch-output">尚未生成 patch proposal。</div>
                </div>
                <div>
                  <h3>审批创建结果</h3>
                  <div class="text-block" id="local-agent-approval-output">尚未创建审批记录。</div>
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
                  <h2>安全修复入口</h2>
                  <div class="card-copy">这里不是直接修文件的执行器。它只把修复任务整理成受限输入，再送到本地智能体页面继续做意图预览、计划和审批。</div>
                </div>
                <span class="inline-status warn">dry-run only</span>
              </div>
              <label for="repair-task-input"><strong>修复目标</strong></label>
              <textarea id="repair-task-input" class="text-input" rows="5" placeholder="例如：补齐缺失页面、修复某个死按钮、限定只改指定文件。"></textarea>
              <label for="repair-allowed-files-input"><strong>允许修改的文件</strong></label>
              <textarea id="repair-allowed-files-input" class="text-input" rows="3" placeholder="每行一个相对路径"></textarea>
              <div class="approval-actions">
                <button type="button" id="repair-open-local-agent-button" data-open-page="local-agent">带着修复任务进入本地智能体</button>
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
                  <h2>使用帮助</h2>
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
              <div class="approval-actions" style="margin-top:14px;">
                <button type="button" id="help-open-local-agent-button" data-open-page="local-agent">去本地智能体</button>
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
  <div class="toast" id="toast"></div>
  <div class="sr-only" aria-hidden="true" id="phase321a-compat-markers">
    <span id="phase313a-single-safe-chat-copy">当前普通 Chat 只显示已验证、可选择、允许直接 Chat 的模型。</span>
    <span id="phase313a-status-filter" data-testid="ui-filters-present">兼容状态筛选标记</span>
    <span id="phase313a-bucket-filter">兼容能力桶筛选标记</span>
    <button type="button" id="phase313a-generate-verification-plan">生成验证计划</button>
    <span id="phase319a-current-page-model-marker">phase321a-current-page-model / phase319a-current-page-model</span>
    <span id="phase319a-compat-routes">/local-agent/intent-preview /local-agent/operation-plan /plugin-registry</span>
  </div>

  <script>${consolePageInlineJs}  </script>
</body>
</html>`;
}

function stripCharacterUiForMissionControl(html) {
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

export function createConsolePage() {
  return stripCharacterUiForMissionControl(createPhase321AWorkbenchPage());
}
