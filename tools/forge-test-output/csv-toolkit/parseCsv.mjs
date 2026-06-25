export function parseCsv(csvString) {
  const rows = csvString.split('\n');
  const result = [];
  for (const row of rows) {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '\"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim() || '');
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField) {
      fields.push(currentField.trim() || '');
    }
    if (fields.length > 0) {
      result.push(Object.fromEntries(fields.map((field, index) => [`field${index}`, field])));
    }
  }
  return result;
}
