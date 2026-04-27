import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "..");
const files = listJavaScriptFiles(srcRoot).sort();
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: resolve(srcRoot, "../../.."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    failures.push({
      file: toRelativePath(file),
      status: result.status,
      stderr: String(result.stderr || "").trim(),
      stdout: String(result.stdout || "").trim(),
    });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    checkedFiles: files.length,
    failures,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
    checkedFiles: files.length,
    root: "src",
  }, null, 2));
}

function listJavaScriptFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...listJavaScriptFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === ".js") {
      found.push(fullPath);
    }
  }
  return found;
}

function toRelativePath(file) {
  return file.replace(srcRoot + "\\", "src\\").replaceAll("\\", "/");
}
