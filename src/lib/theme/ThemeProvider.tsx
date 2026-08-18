"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyResolvedTheme,
  applyThemeColorMeta,
  readStoredChoice,
  resolveTheme,
  storeChoice,
  systemPrefersLight,
  type ResolvedTheme,
  type ThemeChoice,
} from "./theme";

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline head script already applied the correct class before this
  // component ever mounts (see THEME_INIT_SCRIPT); this state exists so the
  // React-rendered control can name the resolved mode and react to further
  // changes, not so it can pick the theme for the first frame.
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  // False until the stored choice has been read. The initial `resolved`
  // above is a server-render placeholder, not a measurement, and writing
  // the chrome colour from it would repaint a light collector's address bar
  // dark for one tick before the real value lands.
  const [choiceRead, setChoiceRead] = useState(false);

  useEffect(() => {
    // Reading localStorage is a browser-only external system unavailable
    // during the server render, so the client-mount sync this rule usually
    // warns against is exactly what has to happen here: the inline head
    // script (THEME_INIT_SCRIPT) already painted the right scope before
    // this ever runs, this only brings the React-visible label in step.
    const stored = readStoredChoice();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setChoiceState(stored);
    setResolved(resolveTheme(stored));
    setChoiceRead(true);
  }, []);

  // The theme-color metas belong to Next's viewport metadata, which React
  // owns and re-renders: a client navigation appends a fresh one carrying
  // the device-preference value again, measured. The inline head script gets
  // the first frame right and this keeps it right, so the chrome follows the
  // stored choice for the whole session rather than only until the first
  // route change. Watching the head is what makes it deterministic instead
  // of dependent on the order React happens to insert those metas in.
  useEffect(() => {
    if (!choiceRead || typeof MutationObserver === "undefined") return;
    applyThemeColorMeta(resolved);
    const observer = new MutationObserver(() => applyThemeColorMeta(resolved));
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content"],
    });
    return () => observer.disconnect();
  }, [choiceRead, resolved]);

  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next: ResolvedTheme = systemPrefersLight() ? "light" : "dark";
      setResolved(next);
      applyResolvedTheme(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    storeChoice(next);
    const nextResolved = resolveTheme(next);
    setResolved(nextResolved);
    applyResolvedTheme(nextResolved);
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
