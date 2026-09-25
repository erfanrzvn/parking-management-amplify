function parseCSV(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; value = '';
    } else value += ch;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('CSV requires a header and at least one data row');
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV headers');
  for (const key of ['email', 'building', 'floor', 'unitNumber', 'plate']) {
    if (!headers.includes(key)) throw new Error(`CSV is missing ${key}`);
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Wrong column count in row ${index + 2}`);
    return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  });
}
module.exports = { parseCSV };
