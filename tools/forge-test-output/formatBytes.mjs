export function formatBytes(bytes) {
  if (typeof bytes !== 'number') {
    throw new TypeError('Input must be a number.');
  }
  if (bytes < 0) {
    throw new Error('Input bytes cannot be negative.');
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let index = 0;
  while (bytes >= 1024 && index < units.length - 1) {
    bytes /= 1024;
    index++;
  }
  return `${bytes.toFixed(2)} ${units[index]}`;
}
