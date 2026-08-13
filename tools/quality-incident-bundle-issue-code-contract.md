# 质量门禁 Issue Code 机器可读契约

适用目标脚本：
- `tools/verify-ci-quality-artifacts.mjs`
- `tools/run-quality-ci-gate.mjs`

## 输出字段（标准化）

### 1. 顶层 issue codes

- `issueCodes: Array<IssueCode>`  
  来自告警扫描的扁平化列表，按 `code + severity` 去重。每条结构如下：

```json
{
  "code": "incident_bundle_schema_missing",
  "severity": "high",
  "message": "incident bundle schema missing: ...",
  "artifactPath": ".tmp/quality-trend-incident-bundle.json",
  "source": "verify-ci-quality-artifacts"
}
```

字段说明：
- `code`: 字符串码，主流程约定固定值；高优先级聚合码：
  - `incident_bundle_blocking_failure`
    - 当存在任意高严重度 issue 时补充；表示 CI 门禁会阻塞。
- `severity`: `high | medium | low | info | unknown`
- `message`: 可直接展示给人工的原始信息
- `artifactPath`: 关联文件路径（可为空）
- `source`: 来源脚本/阶段（可为空）

### 2. 汇总字段

- `issueCodeSummary: {`
  - `total`: 总条目数
  - `high`: 高优先级条目数
  - `medium`: 中优先级条目数
  - `low`: 低优先级条目数
  - `info`: 信息级条目数
  - `unknown`: 无法归类条目数
  - `blocking`: `high > 0`
`}`

## 当前脚本中的位置

- `verify-ci-quality-artifacts` 输出顶层字段：
  - `issueCodes`
  - `issueCodeSummary`
  - `incidentBundle.issueCodes`
  - `incidentBundle.issueCodeSummary`
- `run-quality-ci-gate` 输出顶层字段：
  - `issueCodes`
  - `issueCodeSummary`
  - `trendIncidentBundle.issueCodes`
  - `trendIncidentBundle.issueCodeSummary`
- `quality-scorecard`（新增）输出顶层字段：
  - `issueCodes`
  - `issueCodeSummary`
- `quality-trend-summary`（新增）输出顶层字段：
  - `issueCodes`（当 `--guard-output` 生效时输出）
  - `issueCodeSummary`
- `quality-trend-check`（新增）输出顶层字段：
  - `issueCodes`
  - `issueCodeSummary`
- `public-repo-check`（新增）输出顶层字段：
  - `issueCodes`
  - `issueCodeSummary`
- `mcp-smoke`（新增）输出顶层字段：
  - `issueCodes`
  - `issueCodeSummary`

## 告警接入建议

- 阻塞判定：优先使用 `issueCodeSummary.blocking === true`
- 计数告警：当 `issueCodeSummary.high >= 1` 时建议触发 P1/P0 升级
- 业务告警可按 `code` 维度聚合，配合 `severity` 过滤
