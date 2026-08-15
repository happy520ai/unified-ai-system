import { describe, it, expect } from "vitest";
import { cleanPublicKnowledgeText, hasSecretLikeContent } from "./publicKnowledgeCleaner.js";

describe("public-knowledge-cleaner", () => {
  it("strips HTML tags from text", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "<p>Hello <b>world</b></p>",
      sourceFamily: "wikipedia",
    });
    expect(result.rejected).toBe(false);
    expect(result.cleanedText).toBe("Hello world");
  });

  it("strips script and style tags", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "<script>alert('xss')</script><style>.x{}</style>content",
    });
    expect(result.cleanedText).toBe("content");
  });

  it("rejects text containing secret-like patterns", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "my api-key is sk-1234567890",
    });
    expect(result.rejected).toBe(true);
    expect(result.secretLikeDetected).toBe(true);
    expect(result.cleanedText).toBe("");
    expect(result.sanitizedPreview).toBe("[secret-like content rejected]");
  });

  it("rejects text containing .env references", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "load from .env file",
    });
    expect(result.rejected).toBe(true);
  });

  it("rejects text containing password references", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "the password is hidden",
    });
    expect(result.rejected).toBe(true);
  });

  it("normalizes whitespace", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "hello    world\n\n\n  test",
    });
    expect(result.cleanedText).toBe("hello world test");
  });

  it("strips Gutenberg boilerplate", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "*** START OF THIS PROJECT GUTENBERG EBOOK test ***\n\nActual content here.\n\n*** END OF THIS PROJECT GUTENBERG EBOOK",
    });
    expect(result.cleanedText).toContain("Actual content here");
    expect(result.cleanedText).not.toContain("GUTENBERG");
  });

  it("returns sourceFamily from input", () => {
    const result = cleanPublicKnowledgeText({
      rawText: "hello",
      sourceFamily: "arxiv",
    });
    expect(result.sourceFamily).toBe("arxiv");
  });

  it("defaults sourceFamily to unknown", () => {
    const result = cleanPublicKnowledgeText({ rawText: "hello" });
    expect(result.sourceFamily).toBe("unknown");
  });

  it("sets correct cleaningMethod", () => {
    const result = cleanPublicKnowledgeText({ rawText: "hello" });
    expect(result.cleaningMethod).toBe("deterministic-html-whitespace-gutenberg-preview");
    expect(result.llmCleaningCalled).toBe(false);
  });

  it("charLength matches cleanedText length for non-rejected", () => {
    const result = cleanPublicKnowledgeText({ rawText: "hello world" });
    expect(result.charLength).toBe(result.cleanedText.length);
  });

  it("charLength is 0 for rejected content", () => {
    const result = cleanPublicKnowledgeText({ rawText: "sk-secret" });
    expect(result.charLength).toBe(0);
  });

  it("hasSecretLikeContent detects secrets", () => {
    expect(hasSecretLikeContent("sk-12345")).toBe(true);
    expect(hasSecretLikeContent("normal text")).toBe(false);
  });

  it("accepts text field as alternative to rawText", () => {
    const result = cleanPublicKnowledgeText({ text: "hello from text field" });
    expect(result.cleanedText).toBe("hello from text field");
  });
});
