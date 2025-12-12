// src/app/create-market/tickers.ts
export function sanitizeTicker(raw: string, maxLen = 4) {
  // Uppercase and strip non A–Z / 0–9
  const up = raw.toUpperCase();
  const stripped = up.replace(/[^A-Z0-9]/g, '');
  return stripped.slice(0, maxLen);
}

export function isValidTicker(t: string, maxLen = 4) {
  if (!t) return false;
  if (t.length > maxLen) return false;
  return /^[A-Z0-9]+$/.test(t);
}
