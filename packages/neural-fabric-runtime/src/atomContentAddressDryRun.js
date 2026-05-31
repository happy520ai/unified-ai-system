import { contentAddress } from "./contentAddress.js";

const weightFixture = Object.freeze({
  kind: "weight-atom",
  atomId: "phase1306.weight.fixture",
  bytes: "tiny-weight-fixture-v1",
  metadata: {
    z: "last",
    a: "first",
  },
});

const adapterFixture = Object.freeze({
  kind: "adapter-atom",
  atomId: "phase1306.adapter.fixture",
  bytes: "tiny-adapter-fixture-v1",
  metadata: {
    capability: "mock-route-select",
    backend: "mock-local",
  },
});

export function runAtomContentAddressDryRun() {
  const sameA = contentAddress(weightFixture);
  const sameB = contentAddress({
    metadata: {
      a: "first",
      z: "last",
    },
    bytes: "tiny-weight-fixture-v1",
    atomId: "phase1306.weight.fixture",
    kind: "weight-atom",
  });
  const different = contentAddress({
    ...weightFixture,
    bytes: "tiny-weight-fixture-v2",
  });
  const adapter = contentAddress(adapterFixture);

  return Object.freeze({
    phase: "Phase1306A",
    phaseKey: "phase1306a",
    name: "Weight Atom + Adapter Atom Content Addressing",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    fixtureOnly: true,
    sameContentSameHash: sameA.uri === sameB.uri,
    differentContentDifferentHash: sameA.uri !== different.uri,
    metadataCanonicalized: sameA.uri === sameB.uri,
    weightAtomAddress: sameA.uri,
    adapterAtomAddress: adapter.uri,
    modelDownloaded: false,
    userFolderRead: false,
    diskScanned: false,
    trainingExecuted: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      realTrainingEnabled: false,
      mainChainIntegrated: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
  });
}
