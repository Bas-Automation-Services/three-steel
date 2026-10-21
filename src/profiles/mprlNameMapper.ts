// Maps IDEA StatiCa MPRL section names (e.g. "UniversalColumn BS EN10210-2 1990 UC305x305x97")
// onto catalog profile ids ("UC305x305x97"). The section designation is the last
// whitespace-separated token; an alias table covers names whose token does not match a
// catalog id directly. Extend ALIASES as new library fixtures surface irregular names.

/** Irregular MPRL designations → catalog ids (keys compared case-insensitively). */
const ALIASES = new Map<string, string>([
  // seeded empty; populated from real Keppel fixture names as they appear
]);

/**
 * Extracts the catalog profile id for an MPRL section name, or null when the name is blank.
 * The returned id is normalized (upper-case family prefix, lower-case separators) but NOT
 * guaranteed to exist in a catalog — resolve via getProfile (EU + UK built-ins).
 */
export function mprlToProfileId(mprlName: string | null): string | null {
  if (!mprlName || mprlName.trim().length === 0) return null;

  let token = mprlName.trim();
  const lastSpace = token.lastIndexOf(' ');
  if (lastSpace >= 0) token = token.slice(lastSpace + 1);

  const alias = ALIASES.get(token.toLowerCase());
  if (alias) return alias;

  return normalize(token);
}

/** Upper-cases the family prefix and lower-cases the 'x' separators: "uc305X305X97" → "UC305x305x97". */
function normalize(token: string): string {
  const chars = token.split('');
  let inPrefix = true;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inPrefix && /[a-zA-Z]/.test(c)) chars[i] = c.toUpperCase();
    else if (/[0-9]/.test(c)) inPrefix = false;
    else if (!inPrefix && (c === 'X' || c === 'x')) chars[i] = 'x';
  }
  return chars.join('');
}
