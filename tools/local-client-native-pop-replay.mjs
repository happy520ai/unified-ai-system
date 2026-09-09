import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLocalClientPopReplayStoreMode, resolveLocalClientPopReplayPath, assertNativePopReplayPathIsolation,
  materializeConfiguredLocalClientPopRegistryKey, enrollConfiguredLocalClientNativePopReplayBaseline,
} from '../apps/ai-gateway-service/src/capabilities/localClientPopReplayConfiguration.ts';
import { readNativePopReplayConfiguration } from '../apps/ai-gateway-service/src/capabilities/localClientNativePopReplayRuntime.ts';

const usage = 'Usage: node tools/local-client-native-pop-replay.mjs enroll-baseline --yes\n'
  + 'Use the same local-client environment, host, namespace, limits and registry secret reference as the gateway.\n'
  + 'This explicitly enrolls only a new or identical generation-one protected replay baseline. It never resets an existing used store.\n';

export async function runLocalClientNativePopReplayCommand(args, env = process.env, write = text => process.stdout.write(text)) {
  if (args.length === 1 && args[0] === '--help') { write(usage); return 0; }
  let stage = 'arguments', registryKey;
  try {
    if (args.length !== 2 || args[0] !== 'enroll-baseline' || args[1] !== '--yes') throw new Error('INVALID_ARGUMENTS');
    stage = 'configuration';
    if (readLocalClientPopReplayStoreMode(env) !== 'sqlite' || !readNativePopReplayConfiguration(env)) throw new Error('NATIVE_CONFIGURATION_REQUIRED');
    assertNativePopReplayPathIsolation(env, resolveLocalClientPopReplayPath(env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH));
    registryKey = materializeConfiguredLocalClientPopRegistryKey(env);
    stage = 'enrollment';
    const checkpoint = await enrollConfiguredLocalClientNativePopReplayBaseline(env, registryKey);
    write(JSON.stringify({ success: true, operation: 'enroll-baseline', checkpointVersion: checkpoint.checkpointVersion,
      generation: checkpoint.generation, storeBindingSha256: checkpoint.storeBindingSha256,
      anchorBindingSha256: checkpoint.anchorBindingSha256, checkpointDigestSha256: checkpoint.checkpointDigestSha256 }) + '\n');
    return 0;
  } catch {
    write(JSON.stringify({ success: false, operation: 'enroll-baseline', code: 'LOCAL_CLIENT_NATIVE_POP_ENROLLMENT_REJECTED',
      outcome: stage === 'enrollment' ? 'unconfirmed' : 'not-started',
      message: 'Verify the explicit configuration and inspect existing state before retrying. No state reset or automatic retry was performed.' }) + '\n');
    return 1;
  } finally { registryKey?.fill(0); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runLocalClientNativePopReplayCommand(process.argv.slice(2));
}
