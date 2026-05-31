import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const sourcePath = path.join(repoRoot, "docs", "phase323c-recommended-command-index.md");

async function main() {
  const markdown = await readFile(sourcePath, "utf8");
  process.stdout.write(markdown.trim() + "\n");
}

main().catch((error) => {
  console.error("[phase323c] failed to print recommended commands:", error.message);
  process.exitCode = 1;
});
