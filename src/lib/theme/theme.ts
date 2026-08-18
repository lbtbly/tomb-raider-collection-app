// Theme resolution. Three stored states -- "light", "dark", "system" -- and
// exactly two rendered scopes: the dark `:root` scope (default) and the
// light `.lt` scope, applied as a class on <html>. System resolves against
// `(prefers-color-scheme: light)` and the control names what it resolved to,
// per DESIGN.md note 5, because otherwise a collector cannot tell whether
// the app or the device disagrees with what they expect.

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "vitrine:theme";
export const LIGHT_CLASS = "lt";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

export function systemPrefersLight(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return systemPrefersLight() ? "light" : "dark";
  return choice;
}

// The two grounds, DERIVED from src/app/globals.css rather than copied into
// it: `:root --g` for dark, `.lt --g` for light. A meta theme-color is
// consumed by browser chrome outside CSS and cannot reference a custom
// property, so a value does have to reach TypeScript. It gets there by
// machine. These were two hand-written literals until C26 counted them, and
// the comment that stood here promised they would move when --g moved, which
// is a promise a person keeps rather than something the build enforces.
// `npm run check:theme-colors` now enforces it.
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "./theme-colors.generated";
export { THEME_COLOR_DARK, THEME_COLOR_LIGHT };

// The static `themeColor` array in src/app/layout.tsx answers
// `prefers-color-scheme`, which is the device preference, not the stored
// one. A collector who chose light on a dark device would still get dark
// chrome above a light page. This rewrites the content of every rendered
// theme-color meta to the theme that actually resolved, so the chrome
// follows the choice rather than the device. Writing all of them, rather
// than picking one, is deliberate: whichever media query the browser
// matches now holds the right value.
export function applyThemeColorMeta(resolved: ResolvedTheme): void {
  const color = resolved === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK;
  document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
    // Only write on a real difference. This runs from a MutationObserver on
    // the head (see ThemeProvider), and an unconditional setAttribute would
    // be a mutation that wakes the observer that made it.
    if (tag.getAttribute("content") !== color) tag.setAttribute("content", color);
  });
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle(LIGHT_CLASS, resolved === "light");
  root.style.colorScheme = resolved;
  applyThemeColorMeta(resolved);
}

export function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function storeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage may be unavailable (private mode, quota). The choice still
    // applies for the current session; it just will not persist, which is
    // a smaller failure than throwing on every theme change.
  }
}

// Inlined verbatim into the document head by src/app/layout.tsx, before any
// React output paints, so the correct scope class is already present on
// <html> for the very first frame. C29 counts frames rendered in the wrong
// theme at zero across all three stored states; a script that runs after
// hydration cannot satisfy that, only one that runs before first paint can.
//
// It corrects the theme-color metas here as well, for the same reason and
// at the same moment: Next renders them into the head ahead of this script
// (verified in the served HTML), so they exist to be read by the time this
// runs, and the browser has not yet painted its chrome. Doing it here rather
// than only on mount means the collector who chose against their device gets
// the right address bar on the first frame too, not after hydration.
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var v=localStorage.getItem(k);var choice=(v==="light"||v==="dark"||v==="system")?v:"system";var light=choice==="light"||(choice==="system"&&matchMedia("(prefers-color-scheme: light)").matches);var r=document.documentElement;if(light){r.classList.add("${LIGHT_CLASS}");}r.style.colorScheme=light?"light":"dark";var c=light?"${THEME_COLOR_LIGHT}":"${THEME_COLOR_DARK}";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",c);}}catch(e){}})();`;
