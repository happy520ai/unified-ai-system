# Kubernetes Gateway profile

The existing service renderer can emit a Kubernetes JSON `List` with two PVCs,
one Gateway Deployment and a ClusterIP Service. Generation is local and performs
no cluster, kubeconfig, secret, registry or filesystem-state access.

```sh
node tools/render-gateway-service.mjs --platform kubernetes \
  --image "$IMAGE" --namespace uai-gateway \
  --storage-class "$CSI_CLASS" --storage-size 5Gi > gateway.kubernetes.json
```

`IMAGE` must be a verified `repository@sha256:<64 lowercase hex>` reference and
`CSI_CLASS` must name an actual compatible storage class. Storage size applies to
**each** of the two claims. The renderer rejects tags and mixed native-service
options. It uses the same digest validator as the Compose check. No credential
value is accepted by this command.

Use a Gateway artifact that includes `AI_GATEWAY_MODEL_LIBRARY_STATE_PATH`
support, introduced in `ab251855`; the earlier `e94eb096` and `0a2d0109` test
images do not support that new state location. Confirm the selected image has the
right architecture for its Linux node, or supplies a suitable multi-architecture
index. Rendering a digest does not prove the image exists or has been tested.

## Runtime and storage requirements

- Linux nodes only: a node selector enforces this; the Pod OS field alone does
  not control placement. Containers use UID/GID 1000, a read-only image filesystem,
  dropped capabilities and RuntimeDefault seccomp. No service-account token is
  mounted and no Kubernetes permissions are granted.
- One replica and `Recreate` upgrades are intentional. The two claims use
  `ReadWriteOncePod`, requiring a compatible CSI driver and Kubernetes version
  (the access mode is stable from 1.29). They are not ordinary multi-writer disks.
  Both claims must be mountable by the same Pod on the same node.
- The CSI driver must implement the application's required POSIX file, hardlink,
  rename, locking and flush behavior, and support the configured fsGroup policy.
  fsGroup is not an ownership migration: historical UID 0 files with restrictive
  permissions may still be unreadable by UID 1000. The non-root init container
  creates only the cache directory; it does not repair or chown existing data.
- Authentication refers to an existing `uai-gateway-auth` Secret key named
  `PME_AUTH_TOKEN` in the selected namespace. Provision it through the cluster's
  protected secret procedure. No Secret value, namespace, Ingress or LoadBalancer
  is created by the rendered List. The Service is cluster-internal.
- Provider mode starts as authenticated `fake`, with real calls disabled. Optional
  governance, workforce, knowledge persistence and external Provider configuration
  still require their normal explicit settings, secrets and readiness checks.
  A Windows client authority or a controlled Git workspace is not supplied by
  this container profile.

The root claim mounts at `/app/.data`; the service claim mounts at
`/app/apps/ai-gateway-service/.data`. Model-library state explicitly uses the root
claim. An additional subPath from the service claim preserves the legacy
`evidence/response-cache` location. The init container prepares this directory
using the same pinned image. A bounded memory-backed `/tmp` is ephemeral.
See the [state-path inventory](native-services.md) for optional stores and modes.

The startup/readiness probes use `/ready`; liveness uses `/livez`. A startup probe
allows up to 180 seconds before normal liveness takes over. The 15-second Pod
termination grace exceeds the configured 10-second Gateway shutdown deadline.
Initial resource settings are configuration defaults, not measured Kubernetes
capacity or latency guarantees.

## Review, deploy and recover on the chosen cluster

After choosing and authorizing a target cluster, inspect the namespace, existing
resource names, Secret, storage class, image architecture and data ownership.
Run a server-side dry run and review its diff before applying the generated file:

```sh
kubectl --context "$CONTEXT" apply --server-side --dry-run=server -f gateway.kubernetes.json
kubectl --context "$CONTEXT" diff -f gateway.kubernetes.json
```

Actual application, rollout observation and recovery testing are separate from
rendering. Require the expected build identity, `/ready`, an authenticated fake
request and state continuity after a controlled restart before admitting traffic.
Do not use more replicas, an HPA, a second Deployment or manually shared claims to
bypass the single-writer requirement. Recreate controls normal upgrades; deleting
a Pod manually can create a replacement while the old Pod is still terminating.
The CSI driver's actual single-Pod enforcement and node-failure behavior therefore
need their own tests.

Record both physical volumes, their reclaim policies and the previous image
digest. Stop the sole writer before a consistent protected backup. Do **not**
delete the whole rendered List or namespace as a restart/rollback shortcut: it
contains PVCs, and a Delete reclaim policy can remove their underlying storage.
Keep claims while changing a compatible image. If a data format changed, restore
a verified compatible backup while stopped instead of forcing an old reader.

PVC byte retention does not prove workflow recovery across Pods or nodes.
Workflow and client receipts can bind device/inode/birthtime identities; a remount
may change those identities even when bytes match. This profile provides no
automatic identity rebinding and no cross-node recovery or HA certification.
Reconciliation must remain uncertain when original identity/authorization cannot
be established. Never edit receipt hashes to force acceptance.

## Verification and implementation scope

Local checks cover rendering/input boundaries, previous native renderer behavior,
Compose validator compatibility and structural validation against the official
Kubernetes v1.34.1 OpenAPI schema. They do not exercise cluster admission policies,
the scheduler, a CSI driver, live probes, volume remounts or recovery. Those remain
target-cluster acceptance work; no existing kubeconfig or cluster was used here.

References: [Deployment replacement behavior](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#recreate-deployment),
[PVC access modes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#access-modes),
[security context and volume permissions](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/),
and [versioned OpenAPI schema](https://github.com/kubernetes/kubernetes/blob/v1.34.1/api/openapi-spec/swagger.json).

Language Selection: this is bounded configuration generation, so the existing
Node.js ESM renderer and JSON output remain the lowest-cost fit. YAML/Helm or a
new deployment framework adds dependencies without improving this profile.
Node ESM retains the native renderer's 29/30 playbook score; no runtime dependency
or service is added. Four files cover this branch, its checks, a shared pure
digest validation export with a CLI main guard, and this runbook. Reverting these
changes removes generation support; deployed resources and persistent data must
be handled separately through the verified operator recovery procedure.
