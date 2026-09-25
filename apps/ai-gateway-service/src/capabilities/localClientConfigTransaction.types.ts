// T-094 leaf: type-only declarations extracted from localClientConfigTransaction.ts
// (mechanical move certified by .pm/t094-leaf-closures.json; no runtime declarations dragged).

export type JsonPrimitive = null | boolean | number | string;
export type LocalClientConfigJsonValue = JsonPrimitive | LocalClientConfigJsonValue[] | {
  readonly [key: string]: LocalClientConfigJsonValue;
};

export type LocalClientConfigOperation =
  | Readonly<{
    op: "set";
    path: readonly string[];
    value: LocalClientConfigJsonValue;
  }>
  | Readonly<{
    op: "delete";
    path: readonly string[];
  }>;
