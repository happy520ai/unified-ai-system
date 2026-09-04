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
  const send = process.send?.bind(process);
  if (typeof send !== "function" || !process.connected) {
    process.exitCode = 1;
    return;
  }
  send(result, (error) => {
    if (error) process.exitCode = 1;
    const disconnect = process.disconnect?.bind(process);
    if (process.connected && typeof disconnect === "function") {
      disconnect();
    }
  });
}
