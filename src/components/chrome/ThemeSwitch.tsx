"use client";

import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { ThemeChoice } from "@/lib/theme/theme";

const CHOICES: { value: ThemeChoice; labelKey: "theme.light" | "theme.dark" | "theme.system" }[] = [
  { value: "light", labelKey: "theme.light" },
  { value: "dark", labelKey: "theme.dark" },
  { value: "system", labelKey: "theme.system" },
];

// The three-state theme switch: System is the first-run default, and while
// System is active the control names what it resolved to (DESIGN.md note
// 5), because otherwise a collector cannot tell whether the app or the
// device disagrees with what they expect. One responsive control rather
// than two separately-built desktop/phone variants, given this dispatch's
// scope; it carries the 44px floor, the corner cut, and the inset-shadow
// focus ring a clipped segment needs (trap 7 in the handoff).
//
// The layout lives in globals.css (.themeSwitch, .segGroup), not in inline
// styles. It moved there because inline `display:flex; height:44` on this
// group could not wrap, and a control that cannot wrap pushed the whole
// document to 560px at a 390px viewport: every full-width block below the
// nav then stretched to 560 and the verdict slab was cut off mid-word. A
// rule in the stylesheet can respond to the width it is actually given.
export function ThemeSwitch() {
  const t = useT();
  const { choice, resolved, setChoice } = useTheme();

  return (
    <div className="themeSwitch">
      <div role="radiogroup" aria-label={t("theme.label")} className="segGroup cut8">
        {CHOICES.map(({ value, labelKey }) => {
          const active = choice === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              className="btn seg"
              style={{
                background: active ? "var(--fmint)" : "transparent",
                color: active ? "var(--onacc)" : "var(--ink)",
              }}
              onClick={() => setChoice(value)}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>
      {choice === "system" ? (
        <span className="mono themeResolved">
          {t("theme.resolved", { mode: t(resolved === "light" ? "theme.light" : "theme.dark") })}
        </span>
      ) : null}
    </div>
  );
}
