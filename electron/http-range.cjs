// Single byte ranges support seeking large local render files without loading
// the entire film into the Electron main process. Multipart ranges are rejected.
function parseByteRange(header, size) {
  if (header === undefined) return null;
  const match = typeof header === 'string' && /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size <= 0) throw new RangeError('Unsatisfiable range');
  const number = value => { const n = Number(value); if (!Number.isSafeInteger(n)) throw new RangeError('Invalid offset'); return n; };
  let start, end;
  if (!match[1]) {
    const suffix = number(match[2]);
    if (suffix <= 0) throw new RangeError('Empty suffix');
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = number(match[1]); end = match[2] ? number(match[2]) : size - 1;
    if (start >= size || end < start) throw new RangeError('Unsatisfiable range');
    end = Math.min(end, size - 1);
  }
  return {start, end, length: end - start + 1};
}
module.exports = {parseByteRange};
