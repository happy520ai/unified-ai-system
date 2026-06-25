/**
 * @module ForgeLogger
 * @description Structured, leveled, tagged logger for the Forge code generation engine.
 * Provides a ring-buffered log store with human-readable and JSON output modes.
 *
 * @example
 * import { ForgeLogger, LogLevel } from './logger/index.js';
 *
 * const logger = new ForgeLogger({ module: 'forge:coder', level: LogLevel.DEBUG });
 * logger.info('Generation started', { model: 'gpt-4' });
 *
 * const child = logger.child('forge:verify');
 * child.warn('Verification slow', { elapsed: 3200 });
 */

// ---------------------------------------------------------------------------
// LogLevel enum
// ---------------------------------------------------------------------------

/**
 * @readonly
 * @enum {string}
 */
export const LogLevel = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SILENT: 'silent',
});

/**
 * Numeric severity map used for level comparisons.
 * @type {Readonly<Record<string, number>>}
 */
const LEVEL_ORDER = Object.freeze({
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.SILENT]: 4,
});

/** Maximum number of entries kept in the ring buffer. */
const RING_BUFFER_SIZE = 1000;

// ---------------------------------------------------------------------------
// ForgeLogger
// ---------------------------------------------------------------------------

/**
 * Structured logger with level filtering, module tagging, ring-buffer storage,
 * and dual output modes (human-readable / JSON lines).
 */
export class ForgeLogger {
  /** @type {string} */ #level;
  /** @type {string} */ #module;
  /** @type {{ write(s: string): void }} */ #output;
  /** @type {boolean} */ #jsonMode;

  /**
   * Ring buffer storage.
   * Entries are pushed sequentially; when full the oldest entry is overwritten.
   * @type {Array<LogEntry>}
   */
  #buffer;

  /** @type {number} Current write position in the ring buffer. */
  #bufferHead;

  /** @type {number} Total entries written (may exceed RING_BUFFER_SIZE). */
  #bufferCount;

  /**
   * @typedef {Object} LogEntry
   * @property {string} timestamp - ISO-8601 timestamp
   * @property {string} level     - Log level string
   * @property {string} module    - Module tag (e.g. 'forge:coder')
   * @property {string} message   - Human-readable message
   * @property {*}      [data]    - Optional structured data
   */

  /**
   * Create a new ForgeLogger instance.
   *
   * @param {Object}  [options]
   * @param {string}  [options.level='info']            - Minimum level to log.
   * @param {string}  [options.module='forge']           - Module tag prepended to every entry.
   * @param {{ write(s: string): void }} [options.output=process.stdout] - Writable stream.
   * @param {boolean} [options.jsonMode=false]           - When true, emit JSON lines; otherwise human-readable.
   */
  constructor({ level = LogLevel.INFO, module = 'forge', output = process.stdout, jsonMode = false } = {}) {
    if (!(level in LEVEL_ORDER)) {
      throw new Error(`Invalid log level: "${level}". Must be one of: ${Object.keys(LEVEL_ORDER).join(', ')}`);
    }

    this.#level = level;
    this.#module = module;
    this.#output = output;
    this.#jsonMode = jsonMode;

    this.#buffer = new Array(RING_BUFFER_SIZE);
    this.#bufferHead = 0;
    this.#bufferCount = 0;
  }

  // -----------------------------------------------------------------------
  // Level helpers
  // -----------------------------------------------------------------------

  /**
   * Return the numeric severity for a level string.
   * @param {string} level
   * @returns {number}
   */
  #severity(level) {
    return LEVEL_ORDER[level] ?? -1;
  }

  /**
   * Determine whether a message at the given level should be emitted.
   * @param {string} level
   * @returns {boolean}
   */
  #shouldLog(level) {
    return this.#severity(level) >= this.#severity(this.#level);
  }

  // -----------------------------------------------------------------------
  // Core logging
  // -----------------------------------------------------------------------

  /**
   * Internal log dispatcher. Builds the entry, stores it in the ring buffer,
   * and writes to the output stream when the level passes the threshold.
   *
   * @param {string} level   - Log level.
   * @param {string} message - Log message.
   * @param {*}      [data]  - Optional structured data attached to the entry.
   */
  #log(level, message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.#module,
      message,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    // Store in ring buffer regardless of output level.
    this.#buffer[this.#bufferHead] = entry;
    this.#bufferHead = (this.#bufferHead + 1) % RING_BUFFER_SIZE;
    if (this.#bufferCount < RING_BUFFER_SIZE) {
      this.#bufferCount++;
    }

    if (!this.#shouldLog(level)) {
      return;
    }

    const line = this.#jsonMode ? this.#formatJson(entry) : this.#formatHuman(entry);
    this.#output.write(line + '\n');
  }

  // -----------------------------------------------------------------------
  // Formatters
  // -----------------------------------------------------------------------

  /**
   * Format an entry as a human-readable string.
   *
   * Example:
   *   [2024-01-15T10:30:00.000Z] [INFO] [forge:coder] Message here {extra: "data"}
   *
   * @param {LogEntry} entry
   * @returns {string}
   */
  #formatHuman(entry) {
    const levelTag = entry.level.toUpperCase();
    let line = `[${entry.timestamp}] [${levelTag}] [${entry.module}] ${entry.message}`;

    if (entry.data !== undefined) {
      try {
        line += ' ' + JSON.stringify(entry.data);
      } catch {
        line += ' [unserializable data]';
      }
    }

    return line;
  }

  /**
   * Format an entry as a single JSON line.
   *
   * Example:
   *   {"timestamp":"...","level":"info","module":"forge:coder","message":"...","data":{}}
   *
   * @param {LogEntry} entry
   * @returns {string}
   */
  #formatJson(entry) {
    try {
      return JSON.stringify(entry);
    } catch {
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.level,
        module: entry.module,
        message: entry.message,
        data: '[unserializable]',
      });
    }
  }

  // -----------------------------------------------------------------------
  // Public log methods
  // -----------------------------------------------------------------------

  /**
   * Log a message at the DEBUG level.
   *
   * @param {string} message - The log message.
   * @param {*}      [data]  - Optional structured data.
   */
  debug(message, data) {
    this.#log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log a message at the INFO level.
   *
   * @param {string} message - The log message.
   * @param {*}      [data]  - Optional structured data.
   */
  info(message, data) {
    this.#log(LogLevel.INFO, message, data);
  }

  /**
   * Log a message at the WARN level.
   *
   * @param {string} message - The log message.
   * @param {*}      [data]  - Optional structured data.
   */
  warn(message, data) {
    this.#log(LogLevel.WARN, message, data);
  }

  /**
   * Log a message at the ERROR level.
   *
   * @param {string} message - The log message.
   * @param {*}      [data]  - Optional structured data.
   */
  error(message, data) {
    this.#log(LogLevel.ERROR, message, data);
  }

  // -----------------------------------------------------------------------
  // Child logger
  // -----------------------------------------------------------------------

  /**
   * Create a child logger that inherits this logger's configuration but uses a
   * different module tag.
   *
   * The child receives its own independent ring buffer and output stream reference.
   *
   * @param {string} module - Module tag for the child logger (e.g. 'forge:verify').
   * @returns {ForgeLogger}
   */
  child(module) {
    return new ForgeLogger({
      level: this.#level,
      module,
      output: this.#output,
      jsonMode: this.#jsonMode,
    });
  }

  // -----------------------------------------------------------------------
  // Level management
  // -----------------------------------------------------------------------

  /**
   * Dynamically change the minimum log level.
   *
   * @param {string} level - New minimum log level.
   * @throws {Error} If the level string is not valid.
   */
  setLevel(level) {
    if (!(level in LEVEL_ORDER)) {
      throw new Error(`Invalid log level: "${level}". Must be one of: ${Object.keys(LEVEL_ORDER).join(', ')}`);
    }
    this.#level = level;
  }

  /**
   * Return the current minimum log level.
   *
   * @returns {string}
   */
  getLevel() {
    return this.#level;
  }

  // -----------------------------------------------------------------------
  // Buffer access
  // -----------------------------------------------------------------------

  /**
   * Return all buffered log entries in chronological order (oldest first).
   *
   * The ring buffer stores up to {@link RING_BUFFER_SIZE} entries. When the
   * buffer is full, the oldest entries are silently overwritten.
   *
   * @returns {LogEntry[]}
   */
  getEntries() {
    if (this.#bufferCount < RING_BUFFER_SIZE) {
      // Buffer has not wrapped yet -- entries start at index 0.
      return this.#buffer.slice(0, this.#bufferCount);
    }

    // Buffer has wrapped -- oldest entry is at #bufferHead.
    return [...this.#buffer.slice(this.#bufferHead), ...this.#buffer.slice(0, this.#bufferHead)];
  }

  /**
   * Flush all buffered entries to the output stream.
   *
   * Each entry is written as a single line in the currently configured format
   * (human-readable or JSON). The internal buffer is **not** cleared; use this
   * to replay stored entries to the output.
   */
  flush() {
    const entries = this.getEntries();

    for (const entry of entries) {
      const line = this.#jsonMode ? this.#formatJson(entry) : this.#formatHuman(entry);
      this.#output.write(line + '\n');
    }
  }

  // -----------------------------------------------------------------------
  // Status / introspection
  // -----------------------------------------------------------------------

  /**
   * Return a snapshot of the logger's current configuration and buffer state.
   *
   * @returns {{ level: string, module: string, entryCount: number, jsonMode: boolean }}
   */
  getStatus() {
    return {
      level: this.#level,
      module: this.#module,
      entryCount: this.#bufferCount,
      jsonMode: this.#jsonMode,
    };
  }

  // -----------------------------------------------------------------------
  // Static helpers
  // -----------------------------------------------------------------------

  /**
   * Convenience factory: create a new logger for the given module and level.
   *
   * Equivalent to `new ForgeLogger({ module, level })`.
   *
   * @param {string} [module='forge'] - Module tag.
   * @param {string} [level='info']   - Minimum log level.
   * @returns {ForgeLogger}
   *
   * @example
   * const log = ForgeLogger.create('forge:orchestrator', LogLevel.DEBUG);
   * log.debug('Starting pipeline');
   */
  static create(module = 'forge', level = LogLevel.INFO) {
    return new ForgeLogger({ module, level });
  }
}
