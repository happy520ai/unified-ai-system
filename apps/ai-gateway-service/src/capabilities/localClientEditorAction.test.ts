import { mkdtemp, readFile, writeFile, rm, link, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, onTestFinished, vi } from "vitest";
import { createLocalClientEditorAction, type LocalClientEditorApi } from "../../../agent-console/src/editor/localClientEditorAction.ts";

it("checks original bytes, uses the editor edit/save APIs, and supports exact reverse content", async () => {
  const h = await harness();
  await (await h.prepare(h.payload("before", "after"), new AbortController().signal))();
  expect(await readFile(h.file, "utf8")).toBe("after");
  await (await h.prepare(h.payload("after", "before"), new AbortController().signal))();
  expect(await readFile(h.file, "utf8")).toBe("before");
  expect(h.api.workspace.applyEdit).toHaveBeenCalledTimes(2);
});

it.skipIf(process.platform !== "win32")("accepts the same canonical file when an editor URI lowercases its drive", async () => {
  const h = await harness();
  h.api.workspace.workspaceFolders[0]!.uri.fsPath = h.root[0] === h.root[0]!.toLowerCase()
    ? h.root[0]!.toUpperCase() + h.root.slice(1) : h.root[0]!.toLowerCase() + h.root.slice(1);
  h.document.uri.fsPath = h.file[0] === h.file[0]!.toLowerCase()
    ? h.file[0]!.toUpperCase() + h.file.slice(1) : h.file[0]!.toLowerCase() + h.file.slice(1);
  await (await h.prepare(h.payload("before", "after"), new AbortController().signal))();
  expect(await readFile(h.file, "utf8")).toBe("after");
});

it("does not overwrite an edit that arrives while the final disk check is pending", async () => {
  const h = await harness();
  const commit = await h.prepare(h.payload("before", "after"), new AbortController().signal);
  h.api.workspace.fs.readFile = async () => {
    const snapshot = await readFile(h.file);
    h.setText("user edit during disk read");
    h.document.version++;
    h.document.isDirty = true;
    return snapshot;
  };
  await expect(commit()).rejects.toThrow("LOCAL_CLIENT_EDITOR_ACTION_REJECTED");
  expect(h.document.getText()).toBe("user edit during disk read");
  expect(h.api.workspace.applyEdit).not.toHaveBeenCalled();
});

it.each(["dirty", "changed-buffer", "changed-disk", "cancelled", "hardlink", "untrusted", "extra-path"])(
  "denies %s without applying an editor edit", async (condition) => {
    const h = await harness();
    const controller = new AbortController();
    const commit = await h.prepare(h.payload("before", "after"), controller.signal);
    if (condition === "dirty") h.document.isDirty = true;
    if (condition === "changed-buffer") { h.document.version++; h.setText("user edit"); }
    if (condition === "changed-disk") await writeFile(h.file, "external edit");
    if (condition === "cancelled") controller.abort();
    if (condition === "hardlink") await link(h.file, join(h.root, "alias.txt"));
    if (condition === "untrusted") h.api.workspace.isTrusted = false;
    if (condition === "extra-path") {
      await expect(h.prepare(JSON.stringify({ version: 1, beforeSha256: digest("before"), text: "after", path: "elsewhere" }), controller.signal)).rejects.toThrow();
    } else await expect(commit()).rejects.toThrow();
    expect(h.api.workspace.applyEdit).not.toHaveBeenCalled();
  },
);

async function harness() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "editor-action-unit-"))), file = join(root, "test.txt");
  await writeFile(file, "before");
  onTestFinished(() => rm(root, { force: true, recursive: true }));
  let text = "before";
  const uri = { fsPath: file, scheme: "file" };
  const document = { uri, isDirty: false, version: 1, getText: () => text, positionAt: (offset: number) => offset,
    async save() { await writeFile(file, text); document.isDirty = false; return true; } };
  class Edit { text = ""; replace(_uri: unknown, _range: unknown, value: string) { this.text = value; } }
  const api = { Uri: { file: () => uri }, Range: class { constructor(_a: unknown, _b: unknown) {} }, WorkspaceEdit: Edit,
    workspace: { isTrusted: true, workspaceFolders: [{ uri: { fsPath: root, scheme: "file" } }],
      fs: { readFile: () => readFile(file) }, openTextDocument: async () => document,
      applyEdit: vi.fn(async (edit: unknown) => { text = (edit as Edit).text; document.version++; document.isDirty = true; return true; }) } };
  return { root, file, api, document, setText: (value: string) => { text = value; },
    prepare: createLocalClientEditorAction(api as LocalClientEditorApi, { workspaceRoot: root, allowedFile: file }),
    payload: (before: string, after: string) => JSON.stringify({ version: 1, beforeSha256: digest(before), text: after }) };
}
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
