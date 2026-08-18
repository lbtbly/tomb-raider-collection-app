import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT, THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { LocaleFromUrl } from "@/components/chrome/LocaleFromUrl";
import { TopNav } from "@/components/chrome/TopNav";
import { Footer } from "@/components/chrome/Footer";
import { OfflineBanner } from "@/components/chrome/OfflineBanner";
import { OutboxReplay } from "@/components/chrome/OutboxReplay";
import { ServiceWorkerRegister } from "@/components/chrome/ServiceWorkerRegister";
import { en } from "@/lib/i18n/en";
import { formatMessage } from "@/lib/i18n/format";

export const metadata: Metadata = {
  title: formatMessage(en["app.titleTag"], { name: en["app.name"], tagline: en["app.tagline"] }),
  description: en["footer.disclaimer"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Light and dark are equals, so the browser chrome gets each ground
  // rather than the dark one twice: a single value here painted a dark
  // address bar over a light page. These two entries answer the device
  // preference; applyThemeColorMeta covers the collector who chose against
  // their device, which no media query can see.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning is scoped to this element only (React
          does not propagate it to descendants) and covers exactly the
          class/style the inline script below sets before hydration runs:
          without it, React's hydration diff flags every load as a mismatch
          even though the script produced the right theme on the first
          frame, which is the one thing C29 actually measures. */}
      <head>
        {/* Runs before any paint, so the correct theme scope class is
            already on <html> for the first frame in all three stored
            states (light, dark, system). C29 counts frames rendered in the
            wrong theme at zero; a useEffect cannot satisfy that, only a
            blocking inline script that runs ahead of hydration can. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <LocaleFromUrl>
            <ThemeProvider>
              <OfflineBanner />
              <TopNav />
              <main className="shell">{children}</main>
              <Footer />
              <OutboxReplay />
              <ServiceWorkerRegister />
            </ThemeProvider>
          </LocaleFromUrl>
        </Suspense>
      </body>
    </html>
  );
}
