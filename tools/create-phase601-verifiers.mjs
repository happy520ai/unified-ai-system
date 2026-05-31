import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { phase601Subphases } from "./phase601-registry.mjs";

for (const phase of phase601Subphases) {
  await mkdir(dirname(phase.verifierPath), { recursive: true });
  await writeFile(phase.verifierPath, `import { runPhase601Subphase } from "../phase601-common.mjs";\n\nawait runPhase601Subphase("${phase.key}");\n`, "utf8");
}
