# Forge container sandbox

Forge treats generated shell commands, project test scripts, project ESLint
configuration, TypeScript checks, and smoke-start commands as untrusted code.
Those paths use one `SandboxExecutor` and request `full` isolation. If an
attested backend is not configured, they return
`SANDBOX_BACKEND_UNAVAILABLE`; they never fall back to a host shell.

Git worktrees prevent concurrent edit collisions, but they are not an OS
security boundary. `worktree` execution therefore also requires the container
backend.

## Required backend

The built-in backend supports a local Linux Docker/Podman-compatible daemon.
Configuration is explicit so a service cannot pull or select a mutable image at
runtime:

```js
import {
  AgentPoolManager,
  ContainerSandboxBackend,
  SandboxExecutor,
} from "@unified-ai-system/forge-core";

const projectRoot = "/srv/forge-worktrees/candidate-123";
const backend = new ContainerSandboxBackend({
  enginePath: "/usr/bin/docker",
  image: "registry.example/forge-sandbox@sha256:<64 hex characters>",
  workspaceRoots: ["/srv/forge-worktrees"],
});
const sandboxExecutor = new SandboxExecutor({
  level: "full",
  allowedPaths: ["/srv/forge-worktrees"],
  backend,
  maxTimeMs: 60_000,
  maxMemoryMB: 512,
});

const pool = new AgentPoolManager({
  store,
  projectRoot,
  sandboxExecutor,
});
```

On Windows with Docker Desktop Linux containers, use the absolute
`docker.exe` path and Windows workspace roots. Native Windows `FULL` execution
is not claimed: Node child processes alone cannot prove restricted-token,
AppContainer, Job Object, network, and process-tree guarantees without a native
helper.

## Enforced contract

Every container is created with:

- an already-present image pinned by `sha256` (`--pull never`);
- `--network none` for `full` and `worktree` execution;
- a read-only root, non-root UID/GID, all Linux capabilities dropped,
  `no-new-privileges`, and the Docker default seccomp profile;
- fixed memory, no-swap, CPU, PID, file-descriptor, IPC, and wall-clock limits;
- a single canonical allowlisted workspace mount;
- private bounded `/tmp` and `/scratch` tmpfs mounts;
- a fixed minimal environment. Ambient provider, GitHub, cloud, database,
  proxy, preload, package-manager, and authorization variables are not copied;
- explicit kill, inspect, and forced remove on timeout or cancellation.
  Uncertain cleanup is a failed result.

The backend refuses workspaces containing common top-level credential files
such as `.env`, `.mcp.json`, `.ssh`, or `credentials`. Keep task worktrees free
of secrets and inject only explicitly allowlisted non-secret variables.

`none` is an explicitly unsafe host mode. `process` is also a host mode and is
disabled unless `hostExecutionEnabled: true` is set by a development/test
caller. Neither mode is a substitute for security isolation.

## Verification

The normal test suite proves routing and fail-closed behavior. A real Docker
attack regression is opt-in so credential-free public-clone checks do not
require a daemon:

```bash
FORGE_TEST_DOCKER_ENGINE=/usr/bin/docker \
FORGE_TEST_DOCKER_SANDBOX_IMAGE='node@sha256:<digest>' \
node --test packages/forge-core/test/container-sandbox.integration.test.js
```

That test checks minimal environment inheritance, root/workspace write denial,
network denial, timeout termination, and absence of managed container residue.

## Language selection

This change stays in Node.js ESM because Forge and its process lifecycle are
already Node.js ESM. It adds no runtime language, preserves the public JavaScript
module boundary, and keeps rollback to the previous executor localized. A
future native Windows backend would require its own measured language and
compatibility plan before introduction.
