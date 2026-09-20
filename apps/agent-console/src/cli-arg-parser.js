import { CliUsageError } from "./cli-errors.js";
import {
  COMMANDS,
  COMMAND_ALIASES,
} from "./cli-constants.js";
import {
  addPositional,
  splitFlag,
  readFlagValue,
  assertFlagHasNoInlineValue,
  parseIntegerOption,
} from "./cli-parser-helpers.js";

export function parseCliArgs(
  argv,
  env = process.env,
  validateOptions,
) {
  const options = {
    command: null,
    positionals: [],
    json: false,
    evidence: false,
    help: false,
    version: false,
    url: env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100",
    urlProvided: false,
    timeoutMs: 30_000,
    timeoutProvided: false,
    prompt: null,
    enhance: false,
    profile: "auto",
    profileProvided: false,
    language: "auto",
    languageProvided: false,
    allowRealProvider: false,
    adminKey: env.AGENT_CONSOLE_ADMIN_KEY ?? env.PME_AUTH_TOKEN ?? null,
    controlCenterManifestFile: null,
    onboardingProfileId: null,
    onboardingAction: null,
    onboardingPlanId: null,
    onboardingReceiptFile: null,
    idempotencyKey: null,
    confirmed: false,
    workflowId: null,
    workflowArtifactName: null,
    lifecycleClientId: null,
    lifecycleDisplayName: null,
    lifecycleCapabilities: [],
    lifecycleIncludeDisabled: false,
    lifecycleLimit: null,
    lifecycleOffset: null,
    lifecycleApply: false,
    lifecycleMaxProcesses: null,
    lifecycleIncludeUnknown: false,
    lifecycleIncludeSystemProcesses: false,
    lifecycleIncludeMissingAsDisabled: false,
    lifecycleAutoDiscoverAll: false,
    lifecycleRevision: null,
    lifecycleAdapterId: null,
    lifecycleAdapterType: null,
    lifecycleAdapterVersion: null,
    lifecycleManifestSha256: null,
    lifecycleProtocolVersion: null,
    lifecycleReason: null,
    agentId: null,
    agentApprovalId: null,
    agentName: null,
    agentTask: null,
    agentGoal: null,
    agentTools: [],
    agentTtlSeconds: null,
    agentParentId: null,
    agentMaxIterations: null,
    agentRunTimeoutMs: null,
    agentToolMode: null,
    agentProviderId: null,
    agentModelId: null,
    agentReason: null,
    agentCascade: false,
    operatorInput: null,
    operatorMode: null,
    operatorSources: [],
    operatorPasses: null,
    operatorMaxOutputTokens: null,
    operatorAudioOutput: null,
    host: null,
    port: null,
  };

  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (positionalOnly) {
      addPositional(options, token);
      continue;
    }

    if (token === "--") {
      positionalOnly = true;
      continue;
    }

    if (!token.startsWith("-")) {
      addPositional(options, token);
      continue;
    }

    const [flag, inlineValue] = splitFlag(token);
    if (flag === "--input" || flag === "--mode" || flag === "--source-id" || flag === "--passes" || flag === "--max-output-tokens" || flag === "--audio-output") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      if (flag === "--source-id") options.operatorSources.push(value);
      else if (flag === "--passes") options.operatorPasses = parseIntegerOption(value, flag, 1, 10);
      else if (flag === "--max-output-tokens") options.operatorMaxOutputTokens = parseIntegerOption(value, flag, 1, 16384);
      else if (flag === "--audio-output") {
        if (options.operatorAudioOutput !== null) throw new CliUsageError("--audio-output must not be repeated.");
        options.operatorAudioOutput = value;
      }
      else {
        const key = flag === "--input" ? "operatorInput" : "operatorMode";
        if (options[key] !== null) throw new CliUsageError(`${flag} must not be repeated.`);
        options[key] = value;
      }
      if (inlineValue === null) index += 1;
      continue;
    }

    if (flag === "--json") {
      options.json = true;
      continue;
    }
    if (flag === "--evidence") {
      options.evidence = true;
      continue;
    }
    if (flag === "--help" || flag === "-h") {
      options.help = true;
      continue;
    }
    if (flag === "--version" || flag === "-v") {
      options.version = true;
      continue;
    }
    if (flag === "--allow-real-provider") {
      options.allowRealProvider = true;
      continue;
    }
    if (flag === "--admin-key") {
      options.adminKey = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--manifest") {
      options.controlCenterManifestFile = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--workflow-id" || flag === "--artifact-name") {
      options[flag === "--workflow-id" ? "workflowId" : "workflowArtifactName"] = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--profile-id") {
      options.onboardingProfileId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--action") {
      options.onboardingAction = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--plan-id") {
      options.onboardingPlanId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--receipt-file") {
      options.onboardingReceiptFile = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--idempotency-key") {
      options.idempotencyKey = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--yes") {
      if (inlineValue !== null) {
        throw new CliUsageError("--yes does not accept a value.");
      }
      options.confirmed = true;
      continue;
    }
    if (flag === "--client-id") {
      options.lifecycleClientId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--display-name") {
      options.lifecycleDisplayName = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--capability") {
      options.lifecycleCapabilities.push(readFlagValue(argv, index, flag, inlineValue));
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--include-disabled") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeDisabled = true;
      continue;
    }
    if (flag === "--limit") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleLimit = parseIntegerOption(value, flag, 1, 100);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--offset") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleOffset = parseIntegerOption(value, flag, 0, Number.MAX_SAFE_INTEGER);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--apply") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleApply = true;
      continue;
    }
    if (flag === "--max-processes") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleMaxProcesses = parseIntegerOption(value, flag, 1, 10_000);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--include-unknown") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeUnknown = true;
      continue;
    }
    if (flag === "--include-system-processes") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeSystemProcesses = true;
      continue;
    }
    if (flag === "--include-missing-as-disabled") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeMissingAsDisabled = true;
      continue;
    }
    if (flag === "--auto-discover-all") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleAutoDiscoverAll = true;
      continue;
    }
    if (flag === "--revision") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleRevision = parseIntegerOption(value, flag, 1, Number.MAX_SAFE_INTEGER);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--adapter-id") {
      options.lifecycleAdapterId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--adapter-type") {
      options.lifecycleAdapterType = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--adapter-version") {
      options.lifecycleAdapterVersion = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--manifest-sha256") {
      options.lifecycleManifestSha256 = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--protocol-version") {
      options.lifecycleProtocolVersion = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--reason") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleReason = value;
      options.agentReason = value;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--agent-id") {
      options.agentId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--approval-id") {
      options.agentApprovalId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--name") {
      options.agentName = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--task") {
      options.agentTask = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--goal") {
      options.agentGoal = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--tool") {
      options.agentTools.push(readFlagValue(argv, index, flag, inlineValue));
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--ttl-seconds") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.agentTtlSeconds = parseIntegerOption(value, flag, 1, 2_592_000);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--parent-agent-id") {
      options.agentParentId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--max-iterations") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.agentMaxIterations = parseIntegerOption(value, flag, 1, 25);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--run-timeout-ms") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.agentRunTimeoutMs = parseIntegerOption(value, flag, 1_000, 120_000);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--tool-mode") {
      options.agentToolMode = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--provider-id") {
      options.agentProviderId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--model-id") {
      options.agentModelId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--cascade") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.agentCascade = true;
      continue;
    }
    if (flag === "--enhance") {
      options.enhance = true;
      continue;
    }
    if (flag === "--profile") {
      options.profile = readFlagValue(argv, index, flag, inlineValue);
      options.profileProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--language") {
      options.language = readFlagValue(argv, index, flag, inlineValue);
      options.languageProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--url") {
      options.url = readFlagValue(argv, index, flag, inlineValue);
      options.urlProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--timeout") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.timeoutMs = parseIntegerOption(value, flag, 1, 300_000);
      options.timeoutProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--prompt") {
      options.prompt = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--host") {
      options.host = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--port") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.port = parseIntegerOption(value, flag, 1, 65_535);
      if (inlineValue === null) index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${flag}`);
  }

  if (options.version) {
    options.command = "version";
  } else if (options.help) {
    options.command = "help";
    return options;
  } else if (!options.command) {
    options.command = "help";
  } else {
    options.command = COMMAND_ALIASES.get(options.command) ?? options.command;
  }

  validateOptions(options);
  return options;
}
