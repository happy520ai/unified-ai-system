// Task-owned, offline compilation only: no installation, elevation, service or provider calls.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(repo, 'apps/ai-gateway-service/evidence/product-final');
const sourceRoot = join(repo, 'apps/ai-gateway-service/src/native');
const exists = path => access(path).then(() => true, () => false);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
let stage = 'arguments', output;

async function build() {
  let tests = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; ++i) {
    if (args[i] === '--tests' && !tests) tests = true;
    else if (args[i] === '--output' && output === undefined && args[i + 1]) output = args[++i];
    else fail('JOB_HOST_BUILD_ARGUMENTS');
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') fail('JOB_HOST_BUILD_PLATFORM');
  output ??= join(evidenceRoot, 't064-native-job-build-' + randomUUID());
  if (!isAbsolute(output)) fail('JOB_HOST_BUILD_OUTPUT');
  output = resolve(output);
  const root = await realpath(evidenceRoot), parent = await realpath(dirname(output)), part = relative(root, parent);
  if ((part !== '' && (part === '..' || part.startsWith('..' + sep) || isAbsolute(part))) || parent !== dirname(output)) fail('JOB_HOST_BUILD_OUTPUT_SCOPE');
  if (await exists(output)) fail('JOB_HOST_BUILD_OUTPUT_EXISTS');
  await mkdir(output);

  stage = 'toolchain';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const vswhere = join(programFilesX86, 'Microsoft Visual Studio/Installer/vswhere.exe');
  if (!await exists(vswhere)) fail('JOB_HOST_BUILD_MSVC_MISSING');
  const installation = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
    { encoding: 'utf8', timeout: 10_000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (!isAbsolute(installation) || installation.includes('\n')) fail('JOB_HOST_BUILD_MSVC_MISSING');
  const compilerVersion = (await readFile(join(installation, 'VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt'), 'utf8')).trim();
  if (!/^\d+\.\d+\.\d+$/.test(compilerVersion)) fail('JOB_HOST_BUILD_MSVC_VERSION');
  const vc = join(installation, 'VC/Tools/MSVC', compilerVersion), sdk = join(programFilesX86, 'Windows Kits/10');
  const versions = (await readdir(join(sdk, 'Include'), { withFileTypes: true })).filter(item => item.isDirectory() && /^10\.\d+\.\d+\.\d+$/.test(item.name))
    .map(item => item.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  let sdkVersion;
  for (const version of versions) if (await exists(join(sdk, 'Lib', version, 'um/x64/kernel32.lib')) && await exists(join(sdk, 'Include', version, 'ucrt/stdio.h'))) { sdkVersion = version; break; }
  if (!sdkVersion) fail('JOB_HOST_BUILD_SDK_MISSING');
  const compiler = join(vc, 'bin/Hostx64/x64/cl.exe');
  if (!await exists(compiler)) fail('JOB_HOST_BUILD_MSVC_MISSING');
  const targets = [['workforceNativeJobHost.cpp', 'workforce-native-job-host']];
  if (tests) targets.push(['workforceNativeJobHost.fixture.cpp', 'workforce-native-job-fixture']);
  const files = [];
  for (const [name, stem] of targets) {
    stage = 'compile-' + stem;
    const source = join(sourceRoot, name), executable = join(output, stem + '.exe');
    const flags = ['/nologo', '/std:c++17', '/EHsc', '/W4', '/WX', '/MT', '/O2', '/utf-8', '/guard:cf', '/GS', '/DUNICODE', '/D_UNICODE',
      '/I' + join(vc, 'include'), ...['ucrt', 'shared', 'um'].map(area => '/I' + join(sdk, 'Include', sdkVersion, area)), source,
      '/Fo' + join(output, stem + '.obj'), '/Fe' + executable, '/link', '/LIBPATH:' + join(vc, 'lib/x64'),
      ...['ucrt', 'um'].map(area => '/LIBPATH:' + join(sdk, 'Lib', sdkVersion, area, 'x64')),
      'advapi32.lib', '/INCREMENTAL:NO', '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF'];
    try {
      const diagnostics = execFileSync(compiler, flags, { cwd: output, encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      await writeFile(join(output, stem + '.build.txt'), diagnostics, { flag: 'wx' });
    } catch (error) {
      await writeFile(join(output, stem + '.build.txt'), String(error.stdout ?? '') + String(error.stderr ?? ''), { flag: 'wx' });
      fail('JOB_HOST_BUILD_COMPILE_FAILED');
    }
    files.push({ path: stem + '.exe', sha256: sha256(await readFile(executable)), source: 'apps/ai-gateway-service/src/native/' + name, sourceSha256: sha256(await readFile(source)) });
  }
  stage = 'manifest';
  const result = { status: 'built', protocol: 'uai-native-job-v1', output, compilerVersion, windowsSdkVersion: sdkVersion,
    unsigned: true, serviceInstalled: false, systemApplied: false, files };
  await writeFile(join(output, 'build-manifest.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
try { console.log(JSON.stringify(await build())); }
catch (error) {
  const result = { status: 'failed', stage, code: /^JOB_HOST_BUILD_[A-Z_]+$/.test(error.message) ? error.message : 'JOB_HOST_BUILD_FAILED' };
  if (output && await exists(output) && stage !== 'arguments') await writeFile(join(output, 'build-failed.json'), JSON.stringify(result) + '\n', { flag: 'wx' }).catch(() => {});
  console.log(JSON.stringify(result)); process.exitCode = 1;
}
