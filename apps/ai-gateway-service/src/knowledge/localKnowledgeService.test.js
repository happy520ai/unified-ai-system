import { describe, it, expect, beforeAll } from "vitest";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

describe("local-knowledge-service", () => {
  let service;
  const tenantContext = {
    tenantScopeIdentity: { tenantId: "local-knowledge-test-tenant", userId: "tester" },
  };

  beforeAll(() => {
    service = createLocalKnowledgeService();
  });

  it("reports health as ready", async () => {
    const h = service.getHealth();
    expect(h.status).toBe("ready");
    expect(h.mode).toBe("local-keyword");
    expect(h.documentCount).toBeGreaterThan(0);
  });

  it("lists default sources", async () => {
    const result = service.listSources();
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("retrieves documents by keyword", async () => {
    const result = await service.retrieve({ query: "default command set" });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].text).toBeDefined();
  });

  it("loads and retrieves custom documents", async () => {
    service.loadDocuments({
      sourceId: "test-source",
      sourceTitle: "Test Source",
      documents: [
        { documentId: "doc-1", title: "Custom Doc", text: "This is a custom test document about quantum computing" },
      ],
    }, tenantContext);
    const result = await service.retrieve({ query: "quantum computing" }, tenantContext);
    expect(result.chunks.some((c) => c.text.includes("quantum"))).toBe(true);
  });

  it("retrieves Chinese prose documents with Chinese term queries", async () => {
    service.loadDocuments({
      sourceId: "test-source-zh",
      sourceTitle: "中文测试源",
      documents: [
        {
          documentId: "doc-zh-1",
          title: "蓝鲸计划内部纪要",
          text: "内部编号:蓝鲸计划2026年Q3行动代号是「深潜七号」,预算上限777万元。",
        },
      ],
    }, tenantContext);
    const result = await service.retrieve({ query: "蓝鲸计划 行动代号" }, tenantContext);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].text).toContain("深潜七号");

    const budget = await service.retrieve({ query: "预算上限" }, tenantContext);
    expect(budget.chunks.some((c) => c.text.includes("777"))).toBe(true);
  });

  it("matches Chinese queries against mixed Chinese-English documents", async () => {
    service.loadDocuments({
      sourceId: "test-source-mixed",
      sourceTitle: "Mixed Source",
      documents: [
        {
          documentId: "doc-mixed-1",
          title: "混合语言文档",
          text: "本项目使用 quantum computing 量子计算 加速分子模拟,取得了阶段性成果。",
        },
      ],
    }, tenantContext);
    const result = await service.retrieve({ query: "量子计算 分子模拟" }, tenantContext);
    expect(result.chunks.some((c) => c.text.includes("quantum"))).toBe(true);
  });

  it("returns empty for non-matching query", async () => {
    const result = await service.retrieve({ query: "zzzznonexistentquery12345" });
    expect(result.chunks.length).toBe(0);
  });

  it("supports topK parameter", async () => {
    const result = await service.retrieve({ query: "phase", topK: 1 });
    expect(result.chunks.length).toBeLessThanOrEqual(1);
  });
});
