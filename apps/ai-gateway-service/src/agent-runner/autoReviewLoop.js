import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { getPermissionModePolicy } from "./permissionModePolicy.js";
import {
  AUTO_REVIEW_DEFAULTS,
  AUTO_REVIEW_POLICY,
  isAllowedReviewCommand,
  isBlockedReviewCommand,
  normalizeMaxRounds,
} from "./autoReviewPolicy.js";
import { buildGoNoGoReview } from "./goNoGoReview.js";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));

export const AUTO_REVIEW_LOOP_DEFAULTS = {
  dryRun: AUTO_REVIEW_DEFAULTS.dryRun,
  maxRounds: AUTO_REVIEW_DEFAULTS.maxRounds,
  maxRoundsLimit: AUTO_REVIEW_DEFAULTS.maxRoundsLimit,
};

export function createAutoReviewLoop(options = {}) {
  const mode = typeof options.mode === "string" ? options.mode : "auto_review";
  return {
    mode,
    policy: AUTO_REVIEW_POLICY,
    defaults: AUTO_REVIEW_LOOP_DEFAULTS,
    async run(input = {}) {
      return runAutoReviewLoop({ ...input, mode });
    },
  };
}

export async function runAutoReviewLoop(input = {}) {
  const mode = typeof input.mode === "string" ? input.mode : "auto_review";
  const permissionPolicy = getPermissionModePolicy(mode);
  const dryRun = input.dryRun !== false;
  const maxRounds = normalizeMaxRounds(input.maxRounds);
  const roundPlans = normalizeRoundPlans(input);
  const commandsRun = [];
  const commandsSkipped = [];
  const blockers = [];
  const warnings = [];

  if (!permissionPolicy) {
    blockers.push("missing-permission-mode-policy");
  }

  let roundsExecuted = 0;

  for (let index = 0; index < roundPlans.length && index < maxRounds; index += 1) {
    roundsExecuted += 1;
    const commands = roundPlans[index].commands;

    for (const command of commands) {
      if (isBlockedReviewCommand(command)) {
        commandsSkipped.push({ command, reason: "blocked-command" });
        blockers.push("blocked-command:" + command);
        break;
      }

      if (!isAllowedReviewCommand(command)) {
        commandsSkipped.push({ command, reason: "not-whitelisted" });
        warnings.push("skipped-non-whitelisted-command:" + command);
        continue;
      }

      if (dryRun) {
        commandsSkipped.push({ command, reason: "dry-run-default" });
        continue;
      }

      if (!permissionPolicy?.autoRunSafeVerifiers) {
        commandsSkipped.push({ command, reason: "permission-mode-manual-review" });
        warnings.push("manual-mode-review-command-skipped:" + command);
        continue;
      }

      const result = await executeAllowedReviewCommand(command);
      commandsRun.push(result);
      if (!result.ok) {
        blockers.push("command-failed:" + command);
        break;
      }
    }

    if (blockers.length > 0) {
      break;
    }
  }

  const reviewResult = buildGoNoGoReview({
    blockers,
    warnings,
    commandsRun,
    commandsSkipped,
    evidencePaths: Array.isArray(input.evidencePaths) ? input.evidencePaths : [],
    changedFiles: Array.isArray(input.changedFiles) ? input.changedFiles : [],
    boundaryCheck: {
      fullOpenEnabled: false,
      autoCommit: false,
      autoPush: false,
      releaseOrDeploy: false,
      maxRounds,
      maxRoundsLimit: AUTO_REVIEW_DEFAULTS.maxRoundsLimit,
      dryRun,
    },
    nextSteps: deriveNextSteps({ blockers, warnings, dryRun }),
    approvalRequired: input.approvalRequired === true,
  });

  return {
    mode,
    dryRun,
    maxRounds,
    maxRoundsLimit: AUTO_REVIEW_DEFAULTS.maxRoundsLimit,
    roundsPlanned: roundPlans.length,
    roundsExecuted,
    reviewResult,
  };
}

function normalizeRoundPlans(input = {}) {
  if (Array.isArray(input.rounds) && input.rounds.length > 0) {
    return input.rounds.map((round) => ({
      commands: Array.isArray(round?.commands) ? round.commands.map((entry) => String(entry ?? "").trim()).filter(Boolean) : [],
    }));
  }

  return [{
    commands: Array.isArray(input.commands) ? input.commands.map((entry) => String(entry ?? "").trim()).filter(Boolean) : [],
  }];
}

async function executeAllowedReviewCommand(command) {
  const spec = toExecSpec(command);
  if (!spec) {
    return {
      command,
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "Unsupported allowed command format.",
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(spec.file, spec.args, {
      cwd: repoRoot,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return {
      command,
      ok: true,
      exitCode: 0,
      stdout: trimOutput(stdout),
      stderr: trimOutput(stderr),
    };
  } catch (error) {
    return {
      command,
      ok: false,
      exitCode: typeof error?.code === "number" ? error.code : 1,
      stdout: trimOutput(error?.stdout),
      stderr: trimOutput(error?.stderr || error?.message || String(error)),
    };
  }
}

function toExecSpec(command) {
  if (command.startsWith("node --check ")) {
    return {
      file: "node",
      args: ["--check", command.slice("node --check ".length)],
    };
  }

  if (command === "cmd /c pnpm -r --if-present check") {
    return {
      file: "cmd",
      args: ["/c", "pnpm", "-r", "--if-present", "check"],
    };
  }

  if (command.startsWith("cmd /c pnpm run ")) {
    return {
      file: "cmd",
      args: ["/c", "pnpm", "run", command.slice("cmd /c pnpm run ".length)],
    };
  }

  return null;
}

function trimOutput(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 4000 ? text.slice(0, 4000) : text;
}

function deriveNextSteps({ blockers, warnings, dryRun }) {
  if (blockers.length > 0) {
    return [
      "Review the blocker list before any further patch approval.",
      "Do not continue with additional rounds until the failing command is understood.",
    ];
  }

  if (dryRun) {
    return [
      "Review the dry-run command list and decide whether to re-run under approved auto_review mode.",
    ];
  }

  if (warnings.length > 0) {
    return [
      "Review skipped commands and warnings before making a go/no-go decision.",
    ];
  }

  return [
    "Use the go/no-go review output to decide whether the approved patch is ready for a human follow-up step.",
  ];
}
