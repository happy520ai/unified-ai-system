import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const brainFiles = {
  currentState: "current-state.json",
  goals: "goals.json",
  riskPolicy: "risk-policy.json",
  nextActions: "next-actions.json",
  completionDefinition: "completion-definition.json",
};

function readJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function readProjectBrain(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const brainDir = path.join(repoRoot, "docs/project-brain");
  const brain = {};

  for (const [key, fileName] of Object.entries(brainFiles)) {
    brain[key] = readJson(path.join(brainDir, fileName));
  }

  return brain;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const brain = readProjectBrain();
  console.log(
    JSON.stringify(
      {
        phaseId: brain.currentState.phaseId,
        currentBlocker: brain.currentState.currentBlocker,
        actionCount: brain.nextActions.actions.length,
      },
      null,
      2,
    ),
  );
}
