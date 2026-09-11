import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

/** The small portion of VS Code's API used by the shared VS Code/Cursor action.
 * Runtime callers pass the actual `require("vscode")` object. */
export interface LocalClientEditorApi {
  readonly Uri: { file(path: string): { fsPath: string; scheme: string } };
  readonly Range: new (start: unknown, end: unknown) => unknown;
  readonly WorkspaceEdit: new () => { replace(uri: unknown, range: unknown, text: string): void };
  readonly workspace: {
    readonly isTrusted: boolean;
    readonly workspaceFolders?: readonly { uri: { fsPath: string; scheme: string } }[];
    readonly fs: { readFile(uri: unknown): PromiseLike<Uint8Array> };
    openTextDocument(uri: unknown): PromiseLike<{
      readonly uri: { fsPath: string; scheme: string };
      readonly isDirty: boolean;
      readonly version: number;
      getText(): string;
      positionAt(offset: number): unknown;
      save(): PromiseLike<boolean>;
    }>;
    applyEdit(edit: unknown): PromiseLike<boolean>;
  };
}

/** One explicit existing file, never a path supplied in an HTTP action. No
 * shell, terminal, model, provider, settings, or arbitrary-command capability.
 * Save and receipt persistence are not atomic: the receiver must retain unknown
 * outcomes after a crash or failed save instead of authorizing redispatch. */
export function createLocalClientEditorAction(
  editor: LocalClientEditorApi,
  binding: Readonly<{ workspaceRoot: string; allowedFile: string }>,
) {
  if (!isAbsolute(binding.workspaceRoot) || !isAbsolute(binding.allowedFile)) fail();
  const root = normalizeDrive(resolve(binding.workspaceRoot));
  const file = normalizeDrive(resolve(binding.allowedFile));
  const inside = relative(root, file);
  if (!inside || isAbsolute(inside) || inside.split(sep).includes("..")) fail();
  const uri = editor.Uri.file(file);
  return async (payload: string, signal: AbortSignal): Promise<() => Promise<void>> => {
    const input = JSON.parse(payload);
    if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).sort().join(",") !== "beforeSha256,text,version"
      || input.version !== 1 || !/^[a-f0-9]{64}$/u.test(input.beforeSha256)
      || typeof input.text !== "string" || Buffer.byteLength(input.text, "utf8") > 2_048
      || input.text.includes("\0")) fail();
    await assertBinding();
    if (signal.aborted) fail();
    const document = await editor.workspace.openTextDocument(uri);
    const version = document.version;
    const before = document.getText();
    const after = digest(Buffer.from(input.text, "utf8"));
    await assertBefore();
    return async () => {
      await assertBinding();
      await assertBefore();
      if (signal.aborted) fail();
      // The disk read yields to editor events. Recheck the buffer synchronously
      // immediately before handing the edit to the editor API.
      assertDocument();
      const edit = new editor.WorkspaceEdit();
      edit.replace(uri, new editor.Range(document.positionAt(0), document.positionAt(before.length)), input.text);
      if (!await editor.workspace.applyEdit(edit)) fail();
      // Cancellation after the editor accepted the edit cannot undo it safely.
      // Finish save/readback so the receiving journal can record the outcome.
      if (document.getText() !== input.text || !await document.save()
        || document.isDirty || digest(await editor.workspace.fs.readFile(uri)) !== after) fail();
    };

    async function assertBefore() {
      if (document.uri.scheme !== "file" || normalizeDrive(await realpath(document.uri.fsPath)) !== file) fail();
      assertDocument();
      if (digest(await editor.workspace.fs.readFile(uri)) !== input.beforeSha256) fail();
      assertDocument();
    }

    function assertDocument() {
      if (document.isDirty || document.version !== version || document.getText() !== before
        || digest(Buffer.from(before, "utf8")) !== input.beforeSha256) fail();
    }
  };

  async function assertBinding() {
    const folders = editor.workspace.workspaceFolders;
    if (!editor.workspace.isTrusted || folders?.length !== 1 || folders[0]?.uri.scheme !== "file"
      || normalizeDrive(await realpath(folders[0].uri.fsPath)) !== root || normalizeDrive(await realpath(root)) !== root) fail();
    let path = root;
    for (const segment of inside.split(sep)) {
      path = resolve(path, segment);
      const info = await lstat(path);
      if (info.isSymbolicLink() || (path === file ? !info.isFile() || info.nlink !== 1 : !info.isDirectory())) fail();
    }
    if (normalizeDrive(await realpath(file)) !== file) fail();
  }
}
function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
// Windows realpath preserves the caller's drive-letter case. Only that letter
// is case-insensitive here; directory spelling and symlink checks stay exact.
function normalizeDrive(path: string) { return process.platform === "win32" ? path.replace(/^[a-z]:/u, drive => drive.toUpperCase()) : path; }
function fail(): never { throw new Error("LOCAL_CLIENT_EDITOR_ACTION_REJECTED"); }
