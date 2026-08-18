// A minimal message formatter: plain {token} substitution plus a narrow
// plural form, {token, one {# thing} other {# things}}, which is the only
// ICU feature this catalogue needs. `#` inside a plural branch is replaced
// with the formatted number itself.
//
// Deliberately not a full ICU MessageFormat: the catalogue has one plural
// site per string at most, and pulling in a library for that would be the
// kind of dependency this product's zero-banner, self-hosted posture keeps
// asking not to add.

export type Vars = Record<string, string | number>;

const PLURAL = /\{(\w+),\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g;
const TOKEN = /\{(\w+)\}/g;

export function formatMessage(
  template: string,
  vars: Vars = {},
  locale: string = "en",
): string {
  let out = template.replace(PLURAL, (_m, key: string, one: string, other: string) => {
    const n = Number(vars[key] ?? 0);
    const branch = n === 1 ? one : other;
    const formatted = new Intl.NumberFormat(locale).format(n);
    return branch.replace(/#/g, formatted);
  });
  out = out.replace(TOKEN, (_m, key: string) => {
    const v = vars[key];
    return v === undefined ? `{${key}}` : String(v);
  });
  return out;
}
