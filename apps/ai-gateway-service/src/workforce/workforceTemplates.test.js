import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTemplateById, listTemplates } from "./workforceTemplates.js";

describe("workforce-templates", () => {
  it("lists all templates", () => {
    const templates = listTemplates();
    assert.ok(templates.length >= 5, `Expected at least 5 templates, got ${templates.length}`);
    const ids = templates.map((t) => t.id);
    assert.ok(ids.includes("feature-development"));
    assert.ok(ids.includes("bug-fix"));
    assert.ok(ids.includes("documentation"));
    assert.ok(ids.includes("code-review"));
    assert.ok(ids.includes("release-checklist"));
  });

  it("gets template by id", () => {
    const template = getTemplateById("feature-development");
    assert.ok(template !== null);
    assert.equal(template.id, "feature-development");
  });

  it("returns null for unknown id", () => {
    const template = getTemplateById("nonexistent");
    assert.equal(template, null);
  });

  it("each template has required fields", () => {
    const templates = listTemplates();
    for (const t of templates) {
      assert.ok(t.id !== undefined);
      assert.ok(t.name !== undefined);
      assert.ok(t.description !== undefined);
    }
  });
});
