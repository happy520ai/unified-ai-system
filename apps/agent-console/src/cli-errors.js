export class CliUsageError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CliUsageError";
    this.exitCode = options.exitCode ?? 2;
    this.hint = options.hint;
  }
}
