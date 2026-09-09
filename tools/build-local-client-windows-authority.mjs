// Offline package assembly only. Never installs/starts a service or invokes an installer apply path.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS } from '../apps/ai-gateway-service/src/capabilities/localClientWindowsAuthorityNative.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repo, 'apps/ai-gateway-service/evidence/client-validation-preview');
const sourceRoot = join(repo, 'apps/ai-gateway-service/src/native');
const require = createRequire(import.meta.url);
const slots = [...LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const exists = path => access(path).then(() => true, () => false);
const versionSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });
let stage = 'arguments';

function parseArguments() {
  const args = process.argv.slice(2); let output, nodeLicense, nativeOnly = false;
  for (let i = 0; i < args.length; ++i) {
    if (args[i] === '--native-only' && !nativeOnly) nativeOnly = true;
    else if (args[i] === '--output' && output === undefined && args[i + 1]) output = args[++i];
    else if (args[i] === '--node-license' && nodeLicense === undefined && args[i + 1]) nodeLicense = args[++i];
    else fail('WINDOWS_AUTHORITY_BUILD_ARGUMENTS');
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') fail('WINDOWS_AUTHORITY_BUILD_PLATFORM');
  output ??= join(evidenceRoot, 'native-authority-package-' + randomUUID());
  if (!isAbsolute(output)) fail('WINDOWS_AUTHORITY_BUILD_OUTPUT');
  if (!nativeOnly && (nodeLicense === undefined || !isAbsolute(nodeLicense))) fail('WINDOWS_AUTHORITY_BUILD_NODE_LICENSE_REQUIRED');
  return { output: resolve(output), nativeOnly, nodeLicense };
}
function within(path, root) { const part = relative(root, path); return part !== '' && part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part); }
async function validateNewOutput(output) {
  const allowed = [await realpath(evidenceRoot)];
  const validationRoot = 'E:\\Codex\\validation';
  if (await exists(validationRoot)) allowed.push(await realpath(validationRoot));
  if (await exists(output)) fail('WINDOWS_AUTHORITY_BUILD_OUTPUT_EXISTS');
  const actualParent = await realpath(dirname(output));
  if (!allowed.some(root => actualParent === root || within(actualParent, root))) fail('WINDOWS_AUTHORITY_BUILD_OUTPUT_SCOPE');
  const expected = resolve(actualParent, output.slice(dirname(output).length + 1));
  if (expected !== output) fail('WINDOWS_AUTHORITY_BUILD_OUTPUT_REPARSE');
}
async function discoverToolchain() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const vswhere = join(programFilesX86, 'Microsoft Visual Studio/Installer/vswhere.exe');
  if (!await exists(vswhere)) fail('WINDOWS_AUTHORITY_BUILD_MSVC_MISSING');
  const installation = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
    { encoding: 'utf8', timeout: 10_000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (!isAbsolute(installation) || installation.includes('\n')) fail('WINDOWS_AUTHORITY_BUILD_MSVC_MISSING');
  const compilerVersion = (await readFile(join(installation, 'VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt'), 'utf8')).trim();
  if (!/^\d+\.\d+\.\d+$/.test(compilerVersion)) fail('WINDOWS_AUTHORITY_BUILD_MSVC_VERSION');
  const vc = join(installation, 'VC/Tools/MSVC', compilerVersion), sdk = join(programFilesX86, 'Windows Kits/10');
  const versions = (await readdir(join(sdk, 'Include'), { withFileTypes: true })).filter(item => item.isDirectory() && /^10\.\d+\.\d+\.\d+$/.test(item.name)).map(item => item.name).sort(versionSort).reverse();
  let sdkVersion;
  for (const version of versions) if (await exists(join(sdk, 'Lib', version, 'um/x64/kernel32.lib')) && await exists(join(sdk, 'Include', version, 'ucrt/stdio.h'))) { sdkVersion = version; break; }
  if (!sdkVersion) fail('WINDOWS_AUTHORITY_BUILD_SDK_MISSING');
  const nodeVersion = process.versions.node;
  const nodeCandidates = [
    join(process.env.LOCALAPPDATA ?? '', 'node-gyp/Cache', nodeVersion),
    join(process.env.USERPROFILE ?? '', '.cache/node-gyp', nodeVersion),
  ].filter(isAbsolute);
  let node;
  for (const candidate of nodeCandidates) if (await exists(join(candidate, 'include/node/node_api.h')) && await exists(join(candidate, 'x64/node.lib'))) { node = candidate; break; }
  if (!node) fail('WINDOWS_AUTHORITY_BUILD_NODE_HEADERS_MISSING');
  const compiler = join(vc, 'bin/Hostx64/x64/cl.exe');
  if (!await exists(compiler)) fail('WINDOWS_AUTHORITY_BUILD_MSVC_MISSING');
  return { vc, sdk, sdkVersion, compilerVersion, compiler, node, nodeVersion };
}
function compile(toolchain, source, output, intermediate, addon) {
  const common = ['/nologo', '/std:c++17', '/EHsc', '/W4', '/WX', '/MT', '/O2', '/utf-8', '/guard:cf', '/GS', '/DUNICODE', '/D_UNICODE',
    '/I' + join(toolchain.vc, 'include'), '/I' + join(toolchain.sdk, 'Include', toolchain.sdkVersion, 'ucrt'),
    '/I' + join(toolchain.sdk, 'Include', toolchain.sdkVersion, 'shared'), '/I' + join(toolchain.sdk, 'Include', toolchain.sdkVersion, 'um')];
  if (addon) common.push('/LD', '/I' + join(toolchain.node, 'include/node'));
  const args = [...common, source, '/Fo' + intermediate + '.obj', '/Fe' + output, '/link',
    '/LIBPATH:' + join(toolchain.vc, 'lib/x64'), '/LIBPATH:' + join(toolchain.sdk, 'Lib', toolchain.sdkVersion, 'ucrt/x64'),
    '/LIBPATH:' + join(toolchain.sdk, 'Lib', toolchain.sdkVersion, 'um/x64'),
    'advapi32.lib', 'bcrypt.lib', 'crypt32.lib', 'shell32.lib', 'ole32.lib', 'uuid.lib', 'userenv.lib',
    '/INCREMENTAL:NO', '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF'];
  if (addon) args.push(join(toolchain.node, 'x64/node.lib'), '/IMPLIB:' + intermediate + '.lib');
  // Compiler diagnostics contain only this source/build package, never runtime input or private state.
  execFileSync(toolchain.compiler, args, { timeout: 120_000, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'] });
}
async function bundleEntrypoint(scratch, output, name, functionName) {
  const vitePackage = createRequire(require.resolve('vitest/package.json')).resolve('vite/package.json');
  const { rolldown } = await import(pathToFileURL(createRequire(vitePackage).resolve('rolldown')).href);
  const entry = join(repo, 'apps/ai-gateway-service/src/capabilities/localClientWindowsAuthorityBrokerEntry.ts');
  if (!await exists(entry)) fail('WINDOWS_AUTHORITY_BUILD_ENTRY_MISSING');
  const wrapper = join(scratch, name + '.mjs');
  await writeFile(wrapper, `import { ${functionName} } from ${JSON.stringify(entry.replaceAll('\\', '/'))};\nawait ${functionName}();\n`, { flag: 'wx' });
  const bundle = await rolldown({ input: wrapper, platform: 'node', external: [/^node:/],
    plugins: [{ name: 'reject-external-non-node', resolveId(source) {
      if (source.startsWith('node:')) return { id: source, external: true };
      if (!source.startsWith('.') && !source.startsWith('\0') && !isAbsolute(source)) this.error('Non-Node dependency is outside the native authority package.');
      return null;
    } }],
  });
  try {
    const result = await bundle.write({ file: output, format: 'esm', sourcemap: false, comments: false, codeSplitting: false });
    if (result.output.length !== 1 || result.output[0].type !== 'chunk' || result.output[0].imports.some(item => !item.startsWith('node:'))) fail('WINDOWS_AUTHORITY_BUILD_BUNDLE_SCOPE');
  } finally { await bundle.close(); }
  execFileSync(process.execPath, ['--check', output], { timeout: 10_000, windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] });
}
async function buildPackage(options) {
  stage = 'toolchain'; const toolchain = await discoverToolchain(); await validateNewOutput(options.output);
  if (!options.nativeOnly) {
    stage = 'verify-node-license';
    // Exact notice fetched separately from nodejs/node v25.8.1/LICENSE. This tool
    // performs no network fetch; a different Node release requires its audited notice.
    if (toolchain.nodeVersion !== '25.8.1' || sha256(await readFile(options.nodeLicense)) !== 'd94dd7496d4de9cd130f1eb6e661e43422483663fd48cf3a450d244b9cda6fdc') fail('WINDOWS_AUTHORITY_BUILD_NODE_LICENSE_MISMATCH');
  }
  stage = 'prepare-output'; await mkdir(options.output); const bin = join(options.output, 'bin'), scratch = join(options.output, '.build'); await mkdir(bin); await mkdir(scratch);
  let succeeded = false;
  try {
    stage = 'compile-addon'; compile(toolchain, join(sourceRoot, 'localClientWindowsAuthorityNative.cpp'), join(bin, 'local-client-authority.node'), join(scratch, 'native'), true);
    if (!options.nativeOnly) {
      stage = 'compile-service-host'; compile(toolchain, join(sourceRoot, 'localClientWindowsAuthorityService.cpp'), join(bin, 'authority-broker-host.exe'), join(scratch, 'service'), false);
      stage = 'bundle-worker'; await bundleEntrypoint(scratch, join(bin, 'authority-worker.mjs'), 'worker-wrapper', 'runNativeAuthorityWorker');
      stage = 'bundle-bootstrap-helper'; await bundleEntrypoint(scratch, join(bin, 'authority-install.mjs'), 'install-wrapper', 'runPrepareBootstrap');
      stage = 'copy-node'; await copyFile(process.execPath, join(bin, 'node.exe'));
      if (sha256(await readFile(join(bin, 'node.exe'))) !== sha256(await readFile(process.execPath))) fail('WINDOWS_AUTHORITY_BUILD_NODE_COPY');
      stage = 'copy-licenses'; await mkdir(join(options.output, 'licenses'));
      await copyFile(options.nodeLicense, join(options.output, 'licenses/LICENSE.node'));
      await copyFile(join(repo, 'LICENSE'), join(options.output, 'licenses/LICENSE.project'));
    }
    stage = 'manifest'; const names = options.nativeOnly ? ['local-client-authority.node'] : ['authority-broker-host.exe', 'node.exe', 'authority-worker.mjs', 'authority-install.mjs', 'local-client-authority.node'];
    const files = [];
    for (const name of names) { const artifact = join(bin, name); if (!(await stat(artifact)).isFile()) fail('WINDOWS_AUTHORITY_BUILD_ARTIFACT'); files.push({ path: 'bin/' + name, sha256: sha256(await readFile(artifact)) }); }
    if (!options.nativeOnly) for (const name of ['LICENSE.node', 'LICENSE.project']) files.push({ path: 'licenses/' + name, sha256: sha256(await readFile(join(options.output, 'licenses', name))) });
    const manifest = { version: options.nativeOnly ? 'local-client-windows-authority-native-build-v2' : 'local-client-windows-authority-package-v2', files, anchorIds: slots };
    const manifestBytes = JSON.stringify(manifest, null, 2) + '\n'; await writeFile(join(options.output, 'package-manifest.json'), manifestBytes, { flag: 'wx' });
    for (const file of files) if (sha256(await readFile(join(options.output, file.path))) !== file.sha256) fail('WINDOWS_AUTHORITY_BUILD_HASH_MISMATCH');
    succeeded = true;
    return { status: 'built', nativeOnly: options.nativeOnly, output: options.output, manifestSha256: sha256(manifestBytes), files,
      compilerVersion: toolchain.compilerVersion, windowsSdkVersion: toolchain.sdkVersion, nodeVersion: toolchain.nodeVersion,
      serviceInstalled: false, systemApplied: false, nativeRuntimeVerified: false };
  } finally {
    // Delete only the exact build-intermediate directory created by this invocation.
    const actualScratch = await realpath(scratch);
    if (actualScratch !== resolve(options.output, '.build') || dirname(actualScratch) !== options.output) fail('WINDOWS_AUTHORITY_BUILD_CLEANUP_SCOPE');
    await rm(actualScratch, { recursive: true, force: false });
    if (!succeeded) await writeFile(join(options.output, 'build-failed.json'), JSON.stringify({ status: 'failed', stage }) + '\n', { flag: 'wx' });
  }
}
try { console.log(JSON.stringify(await buildPackage(parseArguments()))); }
catch (error) { console.log(JSON.stringify({ status: 'failed', stage, code: /^WINDOWS_AUTHORITY_[A-Z_]+$/.test(error.message) ? error.message : 'WINDOWS_AUTHORITY_BUILD_FAILED' })); process.exitCode = 1; }
