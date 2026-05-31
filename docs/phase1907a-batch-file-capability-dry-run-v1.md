# Phase1907A Batch File Capability Dry-run v1

Phase1907A adds dry-run support for `batch_create_desktop_spreadsheets`.

## Rules

- Default max batch count is 3.
- Hard max is 5.
- Input must explicitly list filenames, headers, and rows.
- No glob, wildcard, directory listing, Desktop scan, or existing Desktop file read.
- Real batch run remains blocked by default.
