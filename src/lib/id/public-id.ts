// Ten characters of Crockford base32. Minted once per row, never reused.
// Crockford's alphabet excludes I, L, O and U to avoid visual confusion with
// 1, 1, 0 and V, which matters here because a public id appears in a URL a
// collector might read off a screen at a flea market and retype by hand.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function mintPublicId(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(random() * ALPHABET.length);
    out += ALPHABET[idx];
  }
  return out;
}

const VALID = new RegExp(`^[${ALPHABET}]{10}$`);

export function isPublicId(value: string): boolean {
  return VALID.test(value);
}
