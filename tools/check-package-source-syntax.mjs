import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import vm from "node:vm";

if (typeof vm.SourceTextModule !== "function") {
  console.error("check-package-source-syntax requires node --experimental-vm-modules");
  process.exit(1);
}

const roots = process.argv.slice(2);
const sourceRoots = roots.length > 0 ? roots : ["src"];
const packageRoot = process.cwd();
const context = vm.createContext({});
const files = [];

function collectJavaScriptFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", "coverage"].includes(entry.name)) continue;
      collectJavaScriptFiles(fullPath);
      continue;
    }

    if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

for (const root of sourceRoots) {
  const fullRoot = resolve(packageRoot, root);
  if (!statSync(fullRoot).isDirectory()) {
    console.error(`syntax check source root is not a directory: ${root}`);
    process.exit(1);
  }
  collectJavaScriptFiles(fullRoot);
}

files.sort((a, b) => a.localeCompare(b));

for (const file of files) {
  const relativePath = relative(packageRoot, file).replaceAll("\\", "/");
  const source = readFileSync(file, "utf8");

  try {
    new vm.SourceTextModule(source, {
      context,
      identifier: relativePath,
    });
  } catch (error) {
    console.error(error?.stack || String(error));
    console.error(`syntax check failed: ${relativePath}`);
    process.exit(1);
  }
}

console.log(`syntax check passed: ${files.length} files`);
