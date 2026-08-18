// Ten characters of Crockford base32. Minted once per row, never reused.
// Crockford's alphabet excludes I, L, O and U to avoid visual confusion with
// 1, 1, 0 and V, which matters here because a public id appears in a URL a
// collector might read off a screen at a flea market and retype by hand.
//
// Math.random() is deliberate, not an oversight: these ids are public by
// design under publish-then-review, they are not secrets and never gate
// access, and the database column is UNIQUE with the loader retrying on a
// collision (see loadSeedDocument). If a public id is ever asked to double
// as a capability token, that is the trigger to move this to
// crypto.randomInt, not before.

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

// Postgres unique_violation. Shared by every seed-time insert that mints a
// public_id (franchise, catalogue_item, variant): the column is UNIQUE, so a
// collision surfaces as an insert error rather than a silent reuse, and this
// retries with a freshly minted id instead of letting the whole run die.
const UNIQUE_VIOLATION = "23505";

export async function insertWithFreshPublicId<T>(
  attemptInsert: (publicId: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await attemptInsert(mintPublicId());
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code !== UNIQUE_VIOLATION) throw err;
      lastError = err;
    }
  }
  throw new Error(
    `public_id collided ${maxAttempts} times in a row; refusing to retry further.`,
    { cause: lastError },
  );
}
