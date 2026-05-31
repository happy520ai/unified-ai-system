import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const REQUIRED_FILES = [
  "docs/system-atlas/SYSTEM_ATLAS.md",
  "docs/system-atlas/CURRENT_CAPABILITY_LEDGER.md",
  "docs/system-atlas/ENTRYPOINT_MAP.md",
  "docs/system-atlas/SAFETY_BOUNDARY_MAP.md",
  "docs/system-atlas/PHASE_STATUS_LEDGER.md",
  "docs/system-atlas/OWNER_READING_GUIDE.md",
  "apps/ai-gateway-service/evidence/phase-3977a-system-atlas-recovery/result.json",
];

async function main() {
  console.log("[Phase3977A] System Atlas verifier");

  const files = Object.fromEntries(
    await Promise.all(
      REQUIRED_FILES.map(async (file) => [file, await readRequired(file)]),
    ),
  );

  const evidence = JSON.parse(files["apps/ai-gateway-service/evidence/phase-3977a-system-atlas-recovery/result.json"]);
  const safety = files["docs/system-atlas/SAFETY_BOUNDARY_MAP.md"];
  const capabilityLedger = files["docs/system-atlas/CURRENT_CAPABILITY_LEDGER.md"];
  const ownerGuide = files["docs/system-atlas/OWNER_READING_GUIDE.md"];

  const checks = [
    expect(true, evidence.providerCallsMade === false, "providerCallsMade=false"),
    expect(true, evidence.secretsRead === false, "secretsRead=false"),
    expect(true, evidence.deployExecuted === false, "deployExecuted=false"),
    expect(true, evidence.legacyModified === false, "legacyModified=false"),
    expect(true, evidence.projectContextModified === false, "projectContextModified=false"),
    expect(true, evidence.chatRouteModified === false, "chatRouteModified=false"),
    expect(true, evidence.chatGatewayExecuteModified === false, "chatGatewayExecuteModified=false"),
    expect(true, safety.includes("默认不读 secret"), "safety includes default no secret read"),
    expect(true, safety.includes("默认不调用真实 Provider"), "safety includes default no real provider call"),
    expect(true, safety.includes("默认不 deploy"), "safety includes default no deploy"),
    expect(true, safety.includes("默认不改 `legacy/`"), "safety includes legacy boundary"),
    expect(true, safety.includes("默认不改 `PROJECT_CONTEXT.md`"), "safety includes PROJECT_CONTEXT boundary"),
    expect(true, safety.includes("默认不改 `/chat`"), "safety includes /chat boundary"),
    expect(true, safety.includes("默认不改 `/chat-gateway/execute`"), "safety includes /chat-gateway/execute boundary"),
    expect(true, capabilityLedger.includes("dryRunOnly"), "ledger includes dryRunOnly"),
    expect(true, capabilityLedger.includes("mockOnly"), "ledger includes mockOnly"),
    expect(true, capabilityLedger.includes("providerCallActuallyMade"), "ledger includes providerCallActuallyMade"),
    expect(true, ownerGuide.includes("10 分钟"), "guide includes 10-minute route"),
    expect(true, ownerGuide.includes("30 分钟"), "guide includes 30-minute route"),
    expect(true, ownerGuide.includes("2 小时"), "guide includes 2-hour route"),
  ];

  let failed = false;
  for (const check of checks) {
    if (!check.ok) {
      failed = true;
    }
    console.log(`  ${check.ok ? "PASS" : "FAIL"}: ${check.label}`);
  }

  if (failed) {
    console.error("[Phase3977A] FAIL: atlas verification failed.");
    process.exit(1);
  }

  console.log("[Phase3977A] PASS: atlas files and evidence are valid.");
}

function expect(expected, actual, label) {
  return {
    label: `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
    ok: expected === actual,
  };
}

async function readRequired(relativePath) {
  try {
    return await readFile(resolve(repoRoot, relativePath), "utf8");
  } catch (error) {
    console.error(`[Phase3977A] Missing required file: ${relativePath}`);
    throw error;
  }
}

main().catch((error) => {
  console.error("[Phase3977A] Fatal:", error.message);
  process.exit(1);
});
