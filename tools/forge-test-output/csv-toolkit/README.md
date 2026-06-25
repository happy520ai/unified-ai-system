# CSV Toolkit

## Purpose
This CSV Toolkit is designed to parse, clean, and export CSV data efficiently. It provides a modular approach with separate modules for parsing, data cleaning, and exporting.

## Usage
1. **Parse CSV**: Use `parseCsv.mjs` to convert CSV strings into object arrays.
2. **Clean Data**: Utilize `cleanData.mjs` to deduplicate, remove empty rows, and trim strings from parsed data.
3. **Export CSV**: Employ `exportCsv.mjs` (via `index.mjs`) to export cleaned data back into CSV format.

## Modules
### parseCsv.mjs
- **Functionality**: Parses a CSV string into an array of objects.
- **Usage**: `import { parseCsv } from './parseCsv.mjs'; const csvData = parseCsv(csvString);`

### cleanData.mjs
- **Functionality**: Deduplicates, removes empty rows, and trims strings in the object array.
- **Usage**: `import { cleanData } from './cleanData.mjs'; const cleanedData = cleanData(parsedData);`

### exportCsv.mjs & index.mjs
- **Functionality**: Exports the cleaned data into a CSV string. `index.mjs` provides a unified entry point.
- **Usage (via index)**: `import { processCsv } from './index.mjs'; const csvOutput = processCsv(csvString);`
