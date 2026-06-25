/**
 * Level 6: 地狱熔炉 (Inferno) — 极限压力测试
 *
 * 5 个场景，专攻前 5 级未覆盖的维度:
 *   S1: 毒苹果项目 — 12 文件 18 bug 跨文件诊断修复
 *   S2: 递归算法工坊 — 4 算法实现 + 完整测试
 *   S3: Adversarial 工具 — 噪声/截断/假阳性下的判断力
 *   S4: 需求演化马拉松 — 4 轮需求变更的适应性
 *   S5: 不可能任务识别 — 逻辑矛盾需求的拒绝能力
 *
 * 环境变量: NVIDIA_API_KEY (默认 MiMo V2.5 Pro)
 */

import { testState } from "./runInfernoE2EInfra.js";
import { runS1 } from "./runInfernoE2ES1.js";
import { runS2, runS3, runS4, runS5, finalReport } from "./runInfernoE2EScenarios.js";

// Run all scenarios
await runS1();
await runS2();
await runS3();
await runS4();
await runS5();

// Final report
finalReport();

process.exit(testState.failed > 0 ? 1 : 0);
