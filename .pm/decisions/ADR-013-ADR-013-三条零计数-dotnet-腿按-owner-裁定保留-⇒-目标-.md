# ADR-013 ADR-013 三条零计数 dotnet 腿按 owner 裁定保留 ⇒ 目标 (b)(c) 在现行裁定下不可满足

- 日期: 2026-09-24
- 状态: 已接受

## 背景

背景：目标要求 (b) 每条 kind:test|coverage 腿 evidence_level >= tests_observed、(c) 报告级 evidence_level = tests_observed。本仓有 3 条 dotnet test 腿（docs/examples、dotnet-http-smoke、dotnet-openai-sdk）指向无测试框构的示例工程：`dotnet test` 只做还原/构建、一条测试不跑、却 exit 0 ⇒ passed 但零证据，且因等级取最弱腿把整报压到 execution_only。2026-09-23 owner 在 O1（只装计数覆盖件）/O2（不再为无框构工程声明 test 腿）/丙（补真测试）中选「甲：只装覆盖件，不放宽」，即**明确保留这 3 条腿**（未装 O2；T-111 detail 与 checkpoint 已记）。

## 决定

记录一个已经发过的 owner 裁定及其后果，以免后续会话反复“请裁 R2”：三条零计数 dotnet 腿**保留**（只装覆盖件，不放宽判据）。直接后果：在现行裁定下，目标里 (b)/(c) 两项对本仓结构性不可满足；要让它们可达必须改裁（O2 去掉 / 丙 补真测试），两者全部要动仓外或产品代码 ⇒ 只能由 owner 开。证据：T-111 detail/checkpoint（裁定原文所在）+ `.pm/t348-k4-drag-instrument.mjs`（拖底成员点名）+ `.pm/t358-asif-drop-report-level.mjs`（去掉后地板能抬起来的 as-if 复算）+ `.pm/t356-real-leg-outputs-uncountable.mjs`（真跑三腿：只还原/构建、零测试、exit 0）。

## 后果

后果（均为已执行过的测量，不是推断）：(1) K4 永远 = 3，DONE_GATE 的证据等级子句（C12）在该裁定下恒红 ⇒ 目标陈述的 (b)(c) 不可达；objective 本身已为这一分支预写了处置（“都不装⇒3，且此时 K6 不可能成立，必须如实报‘仍不可满足’”），所以本 ADR 只记录现状、不改动判据。(2) 已量过的代价：选 O2 则计划腿数 49→46 且报告级地板抬起（.pm/t354 差分 + .pm/t358 as-if 复算，后者带“删另三条不抬”的控制组）；选丙则需两个耦合决定（改示例工成真实断言测试 + 让控制台输出可数：默认中文控制台被读作 unknown）。(3) 被放弃项：拿单 unit 小绿报替代全量矩阵、调低 completion_evidence.minimum、删 unit —— 均仍禁止。本 ADR **不新裁 anything**；若 owner 改裁（选 O2 或丙），按新裁重算，不回洗旧数字。
