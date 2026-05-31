import { normalizePosition } from "../positionNormalizer.js";
import { normalizeTitle } from "../normalize/titleNormalizer.js";
import { mergeAliases } from "../normalize/aliasMerger.js";
import { dedupeSourcePositions } from "../normalize/sourceDeduper.js";
import { validateOccupationRecord } from "./occupationRecordValidator.js";

export function importLocalManifest(records, options = {}) {
  const imported = [];
  const rejected = [];

  for (const record of records || []) {
    const normalized = normalizePosition({
      ...record,
      canonicalTitle: normalizeTitle(record.canonicalTitle || record.sourceTitle),
      aliases: mergeAliases(record.aliases, [record.sourceTitle, record.canonicalTitle]),
      importStatus: record.importStatus || "local_seed_imported",
      version: record.version || options.version || "phase578-local-seed",
    });
    const validation = validateOccupationRecord(normalized);
    if (validation.valid) imported.push(normalized);
    else rejected.push({ record, validation });
  }

  return {
    noNetworkImport: true,
    sourceBackedPositionLibrary: true,
    imported: dedupeSourcePositions(imported),
    rejected,
    providerCallsMade: false,
    secretValueExposed: false,
  };
}

