import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { phase602Subphases } from "./phase602-registry.mjs";

for (const phase of phase602Subphases) {
  await mkdir(dirname(phase.verifierPath), { recursive: true });
  await writeFile(phase.verifierPath, `import { runPhase602Subphase } from "../phase602-common.mjs";\n\nawait runPhase602Subphase("${phase.key}");\n`, "utf8");
}
