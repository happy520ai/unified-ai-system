import { mkdtemp, mkdir, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCheckpointForResume } from "./agenticCodingLoop.js";

const cleanupPaths = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => (
    rm(path, { recursive: true, force: true })
  )));
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "checkpoint-root-"));
  cleanupPaths.push(root);
  await mkdir(join(root, "checkpoints"));
  return root;
}

describe("agentic checkpoint resume", () => {
  it("reads a checkpoint inside the working directory", async () => {
    const root = await createFixture();
    const checkpointPath = join(root, "checkpoints", "session.json");
    await writeFile(checkpointPath, JSON.stringify({ messages: [] }));

    await expect(readCheckpointForResume(checkpointPath, root)).resolves.toEqual({
      messages: [],
    });
  });

  it("rejects a checkpoint outside the working directory", async () => {
    const root = await createFixture();
    const outsideRoot = await mkdtemp(join(tmpdir(), "checkpoint-outside-"));
    cleanupPaths.push(outsideRoot);
    const checkpointPath = join(outsideRoot, "session.json");
    await writeFile(checkpointPath, "{}");

    await expect(readCheckpointForResume(checkpointPath, root)).rejects.toMatchObject({
      code: "CHECKPOINT_PATH_REJECTED",
    });
  });

  it("rejects checkpoint files larger than 10MB before parsing", async () => {
    const root = await createFixture();
    const checkpointPath = join(root, "checkpoints", "large.json");
    await writeFile(checkpointPath, "");
    await truncate(checkpointPath, (10 * 1024 * 1024) + 1);

    await expect(readCheckpointForResume(checkpointPath, root)).rejects.toMatchObject({
      code: "CHECKPOINT_SIZE_REJECTED",
    });
  });
});
