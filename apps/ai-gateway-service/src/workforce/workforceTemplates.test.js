import { describe, it, expect } from "vitest";
import { getTemplateById, listTemplates } from "./workforceTemplates.js";

describe("workforce-templates", () => {
  it("lists all templates", () => {
    const templates = listTemplates();
    expect(templates.length).toBe(6);
    expect(templates.map((t) => t.id)).toContain("feature-development");
    expect(templates.map((t) => t.id)).toContain("bug-fix");
    expect(templates.map((t) => t.id)).toContain("documentation");
    expect(templates.map((t) => t.id)).toContain("code-review");
    expect(templates.map((t) => t.id)).toContain("release-checklist");
    expect(templates.map((t) => t.id)).toContain("research-design-study");
  });

  it("gets template by id", () => {
    const template = getTemplateById("feature-development");
    expect(template.name).toBe("Feature Development");
    expect(template.execution).toBe("disabled");
  });

  it("returns null for unknown id", () => {
    const template = getTemplateById("nonexistent");
    expect(template).toBeNull();
  });

  it("each template has required fields", () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.description).toBeDefined();
    }
  });
});







