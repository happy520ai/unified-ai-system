import process from "node:process";
import {
  parseDocumentInIsolate,
  serializeParserError,
  type ParserWorkerInput,
} from "./documentParserWorker.ts";

let requestHandled = false;

process.once("message", (input: ParserWorkerInput) => {
  if (requestHandled) return;
  requestHandled = true;
  void parseDocumentInIsolate(input)
    .then((result) => sendResult({ ok: true, result }))
    .catch((error: unknown) => sendResult({
      ok: false,
      error: serializeParserError(error),
    }));
});

process.once("disconnect", () => {
  if (!requestHandled) process.exitCode = 1;
});

function sendResult(result: Record<string, unknown>) {
  if (typeof process.send !== "function" || !process.connected) {
    process.exitCode = 1;
    return;
  }
  process.send(result, (error) => {
    if (error) process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
}
