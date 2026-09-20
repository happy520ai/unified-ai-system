import { describe, it, expect } from "vitest";
import * as contracts from "./index.js";

// shared-contracts 是纯类型契约包：内部用 .js 指定符指向 .ts 源文件
// （tsc/vitest 可解析，裸 Node 不可），因此本冒烟测试走 vitest，
// 与 policy-engine 的 test 惯例一致。运行时只验证 re-export 链
// 真实可加载（语法/路径断裂会在这里暴露），不冒充类型级验证。
describe("shared-contracts 契约模块冒烟", () => {
  it("全部 re-export 链可真实加载且为有效命名空间", () => {
    expect(typeof contracts).toBe("object");
    expect(contracts).not.toBeNull();
  });

  it("不携带任何运行时凭据样字段", () => {
    for (const key of Object.keys(contracts)) {
      expect(/token|secret|password|apikey/i.test(key)).toBe(false);
    }
  });
});
