export function capitalize(str) {
  if (typeof str !== 'string') {
    throw new Error('Input must be a string');
  }
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}
