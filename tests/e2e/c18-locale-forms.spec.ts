// C18: "Dates, integers, decimals, and currency follow the browser locale: a
// de-DE capture shows 1.234,56 EUR and 17.08.2026, and the same rows in en-GB
// show the en-GB forms. Both captured."
//
// Two halves are measurable today and one is not, and the honest thing is to
// say which is which rather than invent a case for the third.
//
//   DATES: measurable. The scan header prints the match date and time through
//   Intl with no locale argument, so it takes the browser's.
//
//   INTEGERS: measurable, with a caveat this file records rather than hides.
//   Every integer the product renders today is either a count below 1000 or a
//   year, and neither de-DE nor en-GB groups those, so the two captures are
//   identical BY ARITHMETIC and not by accident. A year is the interesting
//   case: 1996 must stay 1996 and must never become 1.996, and that is
//   asserted. The magnitude at which the locales diverge is measured through a
//   control in the same page, so "identical" is a fact about the numbers this
//   catalogue holds and not about the instrument.
//
//   CURRENCY: not measurable. No money renders anywhere in the product until
//   slice 4 brings market value. That is asserted too, by sweeping the rendered
//   text for a currency mark and finding none, so the claim "there is nothing
//   to capture" is itself a measurement.
//
// The timezone is pinned to Europe/Berlin in both contexts. Two captures taken
// in two zones can differ by a calendar day for a reason that has nothing to
// do with locale.

import { expect, test, type Page } from "@playwright/test";
import { assertProductionTarget, capture, settle, writeEvidence } from "./harness";

const SEL = {
  input: "#check-identifier",
  submit: 'form button[type="submit"]',
  slab: '[data-testid="verdict"]',
  scanHeader: ".scanh",
  recognizedLabel: "section.vslab .vlead.mono",
};

const TZ = "Europe/Berlin";
const CURRENCY_MARKS = ["€", "$", "£", "¥", "EUR", "USD", "GBP", "JPY"];

const evidence: Record<string, unknown> = {};

async function firstUniqueIdentifier(page: Page, baseURL: string): Promise<string> {
  const res = await page.request.get(new URL("/api/sync/index", baseURL).toString());
  const { rows } = (await res.json()) as {
    rows: { variantPublicId: string; normalizedIdentifiers: string[] }[];
  };
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const value of row.normalizedIdentifiers) {
      holders.set(value, (holders.get(value) ?? new Set()).add(row.variantPublicId));
    }
  }
  const found = [...holders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .find(([, ids]) => ids.size === 1)?.[0];
  expect(found, "no uniquely held identifier in the served catalogue").toBeTruthy();
  return found!;
}

async function captureLocale(page: Page, baseURL: string, locale: string) {
  const identifier = await firstUniqueIdentifier(page, baseURL);

  // The context's own idea of its locale, read from the page. Without this the
  // two captures could be identical because both contexts were en-US.
  const intl = await page.evaluate(() => {
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    return {
      navigatorLanguage: navigator.language,
      resolvedLocale: resolved.locale,
      timeZone: resolved.timeZone,
      // Where the two locales diverge, and the magnitude at which they do.
      integer145: new Intl.NumberFormat().format(145),
      integer1234: new Intl.NumberFormat().format(1234),
      decimal123456: new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(1234.56),
      dateFixed: new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Date.UTC(2026, 7, 17, 12, 0, 0))),
    };
  });

  await page.goto("/");
  await expect(page.locator(SEL.input)).toBeVisible();
  await expect(async () => {
    await page.fill(SEL.input, identifier);
    await page.click(SEL.submit);
    await expect(page.locator(SEL.recognizedLabel)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000, intervals: [250, 250, 500, 500, 1000] });
  await settle(page);

  const header = (await page.locator(SEL.scanHeader).innerText()).replace(/\s+/g, " ").trim();
  // The header reads "<identifier> <date> · <time>". Parsed off the middle dot
  // rather than by splitting on whitespace: the identifier sits in the same
  // string and a de-DE date and an identifier are both runs of digits.
  // The header reads "<identifier> <date> · <time>", and innerText also picks
  // up the screen-reader-only "Checking…" that follows it.
  const stampMatch = header.match(/(\S+)\s+·\s+(\d{1,2}[:.]\d{2}[:.]\d{2}(?:\s?[AP]M)?)/);
  expect(stampMatch, `unparsable scan header: "${header}"`).toBeTruthy();
  const datePart = stampMatch![1]!.trim();
  const stamp = stampMatch![2]!.trim();
  const checkScreen = await capture(page, `c18-check-${locale}`);
  const checkText = await page.locator("body").innerText();

  // The same rows, in both locales: the on-device catalogue listing, which
  // carries the only integer above a handful (the variant count) and a column
  // of years.
  await page.goto("/catalogue");
  await expect(page.locator("body")).toContainText("cached on this device");
  await settle(page);
  const catalogueText = await page.locator("body").innerText();
  // The line carrying the number, not the sentence that happens to share its
  // wording: the screen's own description ends "cached on this device for the
  // offline check" and matched first on the earlier attempt.
  const countLine = catalogueText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^\d[\d.,\u202f\u00a0]*\s+variants?\b/.test(l))!;
  expect(countLine, `no variant count line on /catalogue: ${catalogueText.slice(0, 300)}`).toBeTruthy();
  const firstRows = catalogueText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\b(19|20)\d{2}\b/.test(l))
    .slice(0, 5);
  const catalogueScreen = await capture(page, `c18-catalogue-${locale}`);

  const currencyMarksFound = CURRENCY_MARKS.filter(
    (mark) => checkText.includes(mark) || catalogueText.includes(mark),
  );

  return {
    locale,
    intl,
    identifier,
    scanHeader: header,
    renderedDate: datePart,
    renderedTime: stamp,
    catalogueCountLine: countLine,
    catalogueRowsWithYears: firstRows,
    captures: [checkScreen, catalogueScreen],
    currencyMarksFound,
  };
}

test.describe("de-DE", () => {
  test.use({ locale: "de-DE", timezoneId: TZ, viewport: { width: 390, height: 844 } });
  test("a German browser gets German forms", async ({ page, request, baseURL }) => {
    evidence.target = await assertProductionTarget(request, baseURL!);
    const de = await captureLocale(page, baseURL!, "de-DE");
    evidence.deDE = de;

    expect(de.intl.resolvedLocale, "the context is not actually de-DE").toBe("de-DE");
    expect(de.renderedDate, `de-DE date "${de.renderedDate}"`).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    // The control, and the reason the integer halves match below: German
    // groups with a dot and only from four digits up.
    expect(de.intl.integer1234).toBe("1.234");
    expect(de.intl.decimal123456).toBe("1.234,56");
    expect(de.intl.integer145).toBe("145");
  });
});

test.describe("en-GB", () => {
  test.use({ locale: "en-GB", timezoneId: TZ, viewport: { width: 390, height: 844 } });
  test("a British browser gets British forms", async ({ page, baseURL }) => {
    const en = await captureLocale(page, baseURL!, "en-GB");
    evidence.enGB = en;

    expect(en.intl.resolvedLocale, "the context is not actually en-GB").toBe("en-GB");
    expect(en.renderedDate, `en-GB date "${en.renderedDate}"`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(en.intl.integer1234).toBe("1,234");
    expect(en.intl.decimal123456).toBe("1,234.56");
    expect(en.intl.integer145).toBe("145");
  });
});

test("the two captures are the same rows in two locales", async () => {
  const de = evidence.deDE as Awaited<ReturnType<typeof captureLocale>>;
  const en = evidence.enGB as Awaited<ReturnType<typeof captureLocale>>;
  expect(de, "the de-DE capture did not run").toBeTruthy();
  expect(en, "the en-GB capture did not run").toBeTruthy();

  // Same identifier, same catalogue, same device state: the only difference
  // between the two captures is the locale.
  expect(en.identifier).toBe(de.identifier);
  expect(en.intl.timeZone).toBe(de.intl.timeZone);

  const [dDe, mDe, yDe] = de.renderedDate.split(".");
  const [dEn, mEn, yEn] = en.renderedDate.split("/");
  const sameDay = dDe === dEn && mDe === mEn && yDe === yEn;

  // A year is an integer that must never be grouped, in any locale.
  const groupedYear = [...de.catalogueRowsWithYears, ...en.catalogueRowsWithYears].filter((row) =>
    /\b(19|20)[.,]\d{3}\b/.test(row),
  );

  evidence.comparison = {
    dateClause: {
      deDE: de.renderedDate,
      enGB: en.renderedDate,
      sameCalendarDay: sameDay,
      formsDiffer: de.renderedDate !== en.renderedDate,
      timeZonePinned: de.intl.timeZone,
      deDEtime: de.renderedTime,
      enGBtime: en.renderedTime,
    },
    integerClause: {
      deDE: de.catalogueCountLine,
      enGB: en.catalogueCountLine,
      identical: de.catalogueCountLine === en.catalogueCountLine,
      whyIdentical:
        "the only integers this product renders are a count below 1000 and a year; de-DE and en-GB agree on both, and the locales are shown to diverge at 1234 by the in-page control",
      divergenceControl: { deDE: de.intl.integer1234, enGB: en.intl.integer1234 },
      yearsRendered: { deDE: de.catalogueRowsWithYears, enGB: en.catalogueRowsWithYears },
      yearsIncorrectlyGrouped: groupedYear,
    },
    decimalClause: {
      renderedInTheProduct: "none: no decimal reaches a screen in slice 1",
      divergenceControl: { deDE: de.intl.decimal123456, enGB: en.intl.decimal123456 },
    },
    currencyClause: {
      measurable: false,
      reason:
        "no money renders anywhere in the product until slice 4 brings market value, so there is no currency capture to take",
      currencyMarksFoundOnTheRenderedScreens: [
        ...new Set([...de.currencyMarksFound, ...en.currencyMarksFound]),
      ],
    },
  };

  expect(sameDay, "the two captures are not the same day, so they compare nothing").toBe(true);
  expect(de.renderedDate).not.toBe(en.renderedDate);
  expect(groupedYear, "a year was rendered with a thousands separator").toEqual([]);
  expect(
    (evidence.comparison as { currencyClause: { currencyMarksFoundOnTheRenderedScreens: string[] } })
      .currencyClause.currencyMarksFoundOnTheRenderedScreens,
    "money reached a screen after all, so the currency clause IS measurable and must be measured",
  ).toEqual([]);
});

test.afterAll(() => {
  evidence.recordedAt = new Date().toISOString();
  writeEvidence("c18-locale-forms.json", evidence);
});
