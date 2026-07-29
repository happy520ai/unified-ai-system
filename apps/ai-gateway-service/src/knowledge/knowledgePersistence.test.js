import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createKnowledgePersistence } from "./knowledgePersistence.js";

describe("knowledge persistence", () => {
  it("degrades to an empty document list for corrupted JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "knowledge-persistence-"));
    const fileStorePath = join(root, "documents.json");
    await writeFile(fileStorePath, "{broken");

    try {
      const persistence = createKnowledgePersistence({
        storageMode: "file",
        persistenceDir: root,
        fileStorePath,
      });

      expect(persistence.loadDocuments()).toEqual([]);
      expect(persistence.getStatus().file.documentCount).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
