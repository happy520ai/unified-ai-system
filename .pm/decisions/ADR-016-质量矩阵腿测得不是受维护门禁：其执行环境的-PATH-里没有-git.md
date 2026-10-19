# ADR-016 质量矩阵腿测得不是受维护门禁：其执行环境的 PATH 里没有 git

- 日期: 2026-09-29
- 状态: 已接受

## 背景

pm-mcp 质量矩阵的 test 腿长期无法作为闭环证据：本轮实测根腿 56 秒、3107 用例、12 失败即中止，而同一棵树直接跑 pnpm test 是 24 分钟、逾 4100 用例、EXIT=0。差异不在代码也不在判据，而在执行环境。

## 决定

定位为环境缺陷而非质量缺陷：pm-mcp 服务进程的 PATH 中没有 git（仅 node/npm/pnpm 与 Windows 系统目录），该 PATH 继承自启动它的 ZCode CLI。质量矩阵每条腿都用这个环境 spawn，forge-core 的 git-worktree-security 测试执行 git init 时 spawnSync git ENOENT，12 个用例失败，pnpm 递归随即 bail，导致其后约 1000 个用例（整个 gateway 套件与工具测试）从未执行。证据四件：① dump 根腿 106 个环境变量原样重放，58-73 秒 exit=1，数字逐项吻合；② 失败栈明确为 spawnSync git ENOENT；③ 同一命令在我的 Git Bash 环境（PATH 含 Git）跑 30 分钟 exit=0；④ 同一 dump 环境只把 Git 加回 PATH，git-worktree-security.test.js 8/8 通过，其余（AI_GATEWAY_SMOKE_MODE=real-with-key、TEMP=E:/tmp 两项差异经对照实验证实无害）。

## 后果

矩阵报告在 git 缺失时是一次"部分测量"，不是质量结论：pnpm -r 在第一个失败包处 bail，其后约 1000 个用例根本不跑。任何以矩阵报告为依据的 done 门都会读到 12 个假失败。修法有两个方向，都未实施：(a) 在调用矩阵前自检 git 可 spawn，缺失即明确报错而不是产出误导报告；(b) 让 pm-mcp 服务的 PATH 包含 Git（其 PATH 继承自 ZCode CLI，仓库无法单方面改）。本次采用 (a) 的记录与诊断，未改运行时代码、未改判据。
