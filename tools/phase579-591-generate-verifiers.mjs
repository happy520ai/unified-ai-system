import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hardeningGroups, hardeningSubphases } from "./phase579-591-hardening-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

for (const phase of hardeningSubphases) {
  await mkdir(resolve(repoRoot, "tools", phase.key), { recursive: true });
  const content = [
    `import { runHardeningSubphase } from "../phase579-591-hardening-subphase-runner.mjs";`,
    "",
    `await runHardeningSubphase("${phase.key}");`,
    "",
  ].join("\n");
  await writeFile(resolve(repoRoot, phase.verifierPath), content, "utf8");
}

const packagePath = resolve(repoRoot, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.scripts ||= {};

for (const phase of hardeningSubphases) {
  packageJson.scripts[phase.packageScript] = `node ${phase.verifierPath}`;
}

for (const group of hardeningGroups) {
  packageJson.scripts[group.packageScript] = `node tools/phase579-591-sequential-runner.mjs ${group.key}`;
}

packageJson.scripts["verify:phase579-591-long-horizon-hardening"] = "node tools/phase579-591-sequential-runner.mjs --all";

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: "generated",
  verifierCount: hardeningSubphases.length,
  groupScriptCount: hardeningGroups.length,
  packageJson: "package.json",
}, null, 2));
