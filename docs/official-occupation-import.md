# Offline official occupation candidates

The explicit `importOfficialOnetOccupations()` and `buildOfficialEmployeeCatalog()`
functions use all 1,016 rows of the **O*NET® 31.0 Database Occupation Data** table.
This is a U.S. occupational taxonomy source, not all occupations worldwide,
professional certification, validated AI expertise or permission to perform work.
The existing 60-position seed and 69-entry default employee catalog remain unchanged.
Importing either package performs no read of the new source asset; only an explicit
function call reads it. No network, model request or automatic employee activation
is part of this import.

```js
import { importOfficialOnetOccupations } from "@unified-ai-system/position-library";
import { buildOfficialEmployeeCatalog } from "@unified-ai-system/workforce-scheduler";

const { imported, source } = importOfficialOnetOccupations();
const candidates = buildOfficialEmployeeCatalog();
// imported.length === candidates.length === 1016; source includes version/hash/license.
```

Each candidate retains the exact source code, title, description and provenance.
Its stable ID follows the O*NET-SOC code and does not change when a title changes.
Skills, knowledge, tasks, aliases and seniority applicability remain empty because
this table supplies none of them. Position `confidence: 1` means exact source
fidelity, not demonstrated professional competence. Employee candidates have
`status: "occupation_candidate"`, empty capabilities and allowed task types,
unassigned hierarchy/seniority, required approval, zero concurrency and a dry-run
brain binding with zero requests and zero estimated cost. They are not schedulable.
Capability evaluation, product selection and execution authorization remain separate
work; approving a job title alone cannot grant those capabilities.

## Source, attribution and license

The unchanged asset is
`packages/position-library/src/data/onet-31.0-occupation-data.json`:

- [Official versioned download](https://www.onetcenter.org/dl_files/database/db_31_0_json/occupation_data.json)
  and [31.0 data dictionary](https://www.onetcenter.org/dictionary/31.0/json/occupation_data.html).
- Download requested at `2026-09-08T16:40:43.936Z`; 345,874 original bytes;
  SHA-256 `8eec5d2449c0b96a90fca0f67184b3bf76c15b3549c4f145adb48c3ae55f52f8`.
- Credit: [O*NET® 31.0 Database](https://www.onetcenter.org/database.html),
  U.S. Department of Labor, Employment and Training Administration (USDOL/ETA).
  The data is distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  as specified by the [database content license](https://www.onetcenter.org/license_db.html).
  O*NET® is a trademark of USDOL/ETA.

The raw JSON bytes and occupational text are unchanged. Unified AI System adds
stable IDs, source metadata and inactive candidate safeguards only; these additions
have not been approved, endorsed or tested by USDOL/ETA. The
[importer](../packages/position-library/src/import/officialOnetImporter.ts) and
[catalog adapter](../packages/workforce-scheduler/src/employee/employeeCatalogBuilder.js)
record those additions. The repository's code license does not replace
the source dataset's CC BY 4.0 attribution requirements.

This narrowly reviewed license boundary covers only this version and table.
SOC, ISCO, ESCO, other O*NET tables and other versions retain their existing blocked
import status. The source registry exposes this pinned artifact; it does not grant
network import or blanket redistribution permission for other datasets.

## Reproduce, update and roll back

The importer has a fixed path, bounded regular-file read and identity checks. It
checks byte length and SHA-256 **before** UTF-8 decoding/JSON parsing, then validates
the exact table/version, columns, row keys, counts, field lengths and unique codes.
Unknown versions, changed bytes and duplicate/malformed records fail closed; there
is no fallback to a seed disguised as a successful official import. The adjacent
`.gitattributes` disables text conversion only for this file to retain upstream
CRLF bytes and the same digest in Windows and Linux Git checkouts.

Run `pnpm --filter @unified-ai-system/position-library test` and
`pnpm --filter @unified-ai-system/workforce-scheduler test` for the focused checks.
They exercise the actual 1,016 rows, rejection boundaries, full provenance,
inactive candidates and unchanged default catalogs.

For an update, obtain and license-review a separately versioned official artifact;
retain the previous artifact and importer in version control. Review the byte hash,
dictionary/schema, added/removed codes and changed titles/descriptions before
changing the fixed pin. Source-code IDs permit a meaningful record diff even when
titles change. An update must not invent skills or automatically activate employees.
Rollback restores the previous source artifact and matching importer/metadata
together, then reruns the same focused checks; no database migration is introduced.

## Language Selection and scope

The new parser and bounded file reader use TypeScript in `position-library`, the
owner of occupation sources. Scoring domain fit, maintenance, operability, safety,
migration debt and ecosystem fit in that order: TypeScript `5/5/4/5/5/5` (29/30),
JavaScript `5/4/5/3/5/5` (27/30), Python `3/3/2/4/2/2` (16/30). TypeScript fits the
strict schema and existing Node filesystem boundary; Python would add a runtime
and cross-process protocol without a benefit here.
Existing JavaScript exports, source governance and the catalog adapter receive
small compatible additions. Node's test runner and the existing preview brain
factory are reused; there are no new dependencies, services or persistent stores.

The ten-file boundary and more than 500 added lines are necessary primarily for
the 345 KB licensed source asset (5,114 lines), its per-file Git byte preservation,
the explicit APIs and their tests. This is product source data, not committed
runtime evidence. Runtime/API compatibility remains opt-in and default catalogs
are unchanged. Rollback removes the new APIs/asset and restores these small source
metadata changes; no credentials or Provider configuration are involved.
