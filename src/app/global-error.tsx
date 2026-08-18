"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import {
  LIGHT_CLASS,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  THEME_INIT_SCRIPT,
  readStoredChoice,
  resolveTheme,
  type ResolvedTheme,
} from "@/lib/theme/theme";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { I18nProvider, resolveLocale, useT, type Locale } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { formatMessage } from "@/lib/i18n/format";
import { Footer } from "@/components/chrome/Footer";
import { BoundaryScreen } from "@/components/chrome/BoundaryScreen";

// The root layout itself failing. This is the one boundary that does NOT
// nest: Next.js requires it to render its own <html> and <body>, and it
// replaces the root layout rather than sitting inside it. Everything the
// layout normally supplies has to be rebuilt here by hand, and each of the
// four below is a rubric line that would otherwise fail at exactly the
// moment nobody is looking:
//
//   1. globals.css. Imported here as well as in the layout, or this route
//      renders unstyled text: the exact browser default D3 counts at zero.
//   2. THEME_INIT_SCRIPT, re-inlined into this document's own head. C29
//      counts frames in the wrong theme at zero and currently measures 16
//      frames, 0 wrong. Without this script that number would stop being
//      true here.
//   3. The theme-color metas, both media variants, which the script above
//      then rewrites to whatever theme actually resolved. Otherwise the
//      browser chrome desyncs from the page on this route alone.
//   4. The Footer. C24 and R26 count routes with no disclaimer line at
//      zero, and they hold everywhere else because the Footer is mounted
//      once in the root layout. Here it is mounted explicitly, and it is
//      the same component rather than a copy of its markup.
//
// Metadata exports are not supported in a Client Component, so the tab
// title is the React <title> element, composed from the same catalogue
// entry src/app/layout.tsx uses.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // The locale lives in the URL (?locale=pseudo) and useSearchParams belongs
  // to the router tree this boundary has fallen out of, so the query string
  // is read from the browser directly. It starts at "en" so the server pass
  // and the first client pass agree, then corrects on mount: the pseudo
  // locale is a sweep tool (C16), never a collector's real visit, so one
  // extra render on an error page is the right price for this route being
  // swept like every other.
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    // window.location is a browser-only external system, unavailable during
    // the server render, so the state necessarily lands after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setLocale(resolveLocale(new URLSearchParams(window.location.search).get("locale")));
  }, []);

  // The scope class has to be a React prop here, not only the head script's
  // doing, and this was measured rather than assumed. When the root layout
  // throws on the client, React does not hydrate this tree, it renders it
  // fresh into the existing document, and rendering <html> with no className
  // WIPED the `lt` class the script had already put there: a collector with
  // light stored got a dark global error page, verified at
  // stored=light device=dark before this line existed. Reading storage in a
  // lazy initialiser rather than an effect is what keeps it off the first
  // frame instead of one repaint late (C29). On a server-rendered error
  // there is no window, so this is null, the script gets the first frame
  // right, and suppressHydrationWarning below stops React undoing it.
  const [resolved] = useState<ResolvedTheme | null>(() =>
    typeof window === "undefined" ? null : resolveTheme(readStoredChoice()),
  );

  return (
    <html
      lang="en"
      className={resolved === "light" ? LIGHT_CLASS : undefined}
      style={resolved ? { colorScheme: resolved } : undefined}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning covers exactly the class and colorScheme
          the inline script below sets on this element before hydration. */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Light and dark are equals, so the chrome gets each ground rather
            than the dark one twice, same as src/app/layout.tsx. Once the
            stored choice is readable, both carry it, because the collector
            who chose against their device is exactly the case no media
            query can answer. React owns these attributes here, so writing
            them from state is what makes them stick; the ThemeProvider in
            the body keeps them right if React re-inserts a meta later, the
            same way it does on every other route. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={resolved === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={resolved === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK}
        />
        <title>
          {formatMessage(en["app.titleTag"], { name: en["app.name"], tagline: en["app.tagline"] })}
        </title>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          {/* ThemeProvider is here for one job: its MutationObserver on the
              head rewrites any theme-color meta React re-inserts. Measured
              need, not caution. There is no theme switch on this route to
              change anything. */}
          <ThemeProvider>
            {/* No top nav: its links route through the layout that just
                failed. The recovery here is a full document load, which the
                anchor below performs. .shell carries no top padding of its
                own because the nav normally supplies it. */}
            <main className="shell" style={{ paddingTop: 40 }}>
              <GlobalErrorBody digest={error.digest} />
            </main>
            <Footer />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

function GlobalErrorBody({ digest }: { digest?: string }) {
  const t = useT();
  return (
    <BoundaryScreen
      lead={t("error.generic.lead")}
      action={t("error.generic.action")}
      actions={
        // A plain anchor, not next/link and not retry(): the root layout is
        // what failed, so the recovery that actually clears it is a fresh
        // document load rather than a client re-render of the same tree.
        // {name} is filled from t("app.name"), the one entry that holds the
        // product's name, so under ?locale=pseudo this label renders as one
        // transformed string carrying another: "⟦Řéłóáð ⟦Ṽíţříñé⟧⟧". Nested,
        // not adjacent. src/lib/i18n/pseudo.ts reserves *adjacent* bracket
        // pairs for the concatenation bug it is hunting, so this is the
        // catalogue working, not a miss.
        <div className="fw block">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              the rule exists to stop an accidental full page load. Here the
              full page load is the point: next/link would client-navigate
              back into the root layout that just threw. */}
          <a href="/" className="btn pri b56 full cut8">
            {t("error.global.reload", { name: t("app.name") })}
          </a>
        </div>
      }
      footnote={
        digest ? (
          <p className="mono" style={{ margin: 0, color: "var(--ink3)", fontSize: 13 }}>
            {t("error.reference", { digest })}
          </p>
        ) : null
      }
    />
  );
}
