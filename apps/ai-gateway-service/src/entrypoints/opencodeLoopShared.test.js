import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { repoRoot, resolveRepoPath } from "./opencodeLoopShared.js";

test("resolveRepoPath is anchored to repoRoot instead of the current working directory", () => {
  assert.equal(
    resolveRepoPath("apps/ai-gateway-service/package.json"),
    resolve(repoRoot, "apps/ai-gateway-service/package.json"),
  );
  assert.equal(
    resolveRepoPath("docs/phase3990a-opencode-controlled-loop-bridge.md"),
    resolve(repoRoot, "docs/phase3990a-opencode-controlled-loop-bridge.md"),
  );
});
