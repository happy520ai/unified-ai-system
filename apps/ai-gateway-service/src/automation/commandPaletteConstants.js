import path from "path";

/**
 * Shared path constants for the Command Palette Service.
 * Extracted from commandPaletteService.js to stay under 500 lines.
 */

export const PROVIDERS_CONFIG = path.join(process.cwd(), "providers-config.json");
export const DATA_DIR = path.join(process.cwd(), ".data");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const COMMAND_HISTORY_FILE = path.join(DATA_DIR, "command-history.json");
