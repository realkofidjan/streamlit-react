export function extractYear(name) {
  const match = name.match(/\((\d{4})\)/);
  return match ? parseInt(match[1]) : null;
}

export function cleanName(name) {
  return name
    .replace(/\(\d{4}\)/, '')
    .replace(/[\._\-]/g, ' ')
    .trim();
}

export function pickBestResult(results, year, dateField = 'first_air_date') {
  if (!results || results.length === 0) return null;
  if (!year) return results[0];
  const match = results.find((r) => {
    const d = r[dateField] || r.release_date || r.first_air_date || '';
    return d.startsWith(String(year));
  });
  return match || results[0];
}
