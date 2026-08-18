// Every spelling a lookup should try for one query. One place, so the two
// equivalence rules are combined once and the verdict engine never has to
// know there are two.
//
// The class is closed at two members, and that is a measured result rather
// than an assumption. GTIN (UPC-A 12 against EAN-13 13, ./gtin.ts) and ISBN
// (10 against 13, ./isbn.ts) are the only identifier systems in this
// catalogue that were redesigned mid-life, leaving two valid encodings of
// one object in circulation. Catalogue numbers, SKUs, part numbers and
// matrix runouts have no second form: normalization already absorbs how a
// person types them off a spine (SLUS-00152, "slus 00152", "slus_00152" and
// "SLUS00152" all reach slus00152) and nothing else represents the object.
//
// The two rules overlap on length and nowhere else. Both look at 13-digit
// values; the GTIN rule fires only on a leading 0 and the ISBN rule only on
// a leading 978, so no value can satisfy both and no value gains two
// alternates. A 13-digit EAN that is neither Bookland nor 0-prefixed gains
// nothing, which is correct: it has no second encoding.
//
// Alternates are computed from the GIVEN value only, never from another
// alternate. Nothing is lost by that today (an ISBN-10 widens to a 978
// value, which has no leading zero and so gains no GTIN form; a 12-digit
// GTIN widens to a 0-prefixed value, which is not Bookland and so gains no
// ISBN form) and it keeps the set of tried forms bounded and easy to reason
// about instead of a transitive closure that grows with every future rule.

import { alternateGtinForms } from "./gtin";
import { alternateIsbnForms } from "./isbn";

/**
 * Every form a lookup should try for an already-normalized value: the value
 * as given first, then its GTIN equivalents, then its ISBN equivalents.
 * Order is stable and the given form always leads, so a caller that wants
 * to know which form hit can tell. Never returns duplicates.
 */
export function identifierLookupForms(normalized: string): string[] {
  if (normalized.length === 0) return [];
  const forms = [normalized];
  for (const alt of [...alternateGtinForms(normalized), ...alternateIsbnForms(normalized)]) {
    if (!forms.includes(alt)) forms.push(alt);
  }
  return forms;
}
