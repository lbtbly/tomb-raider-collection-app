import { chromium } from "playwright";
const flagSets = [
  [],
  ["--enable-experimental-web-platform-features"],
  ["--enable-features=ShapeDetection"],
  ["--enable-blink-features=ShapeDetection"],
  ["--enable-features=ShapeDetection", "--enable-experimental-web-platform-features"],
];
for (const args of flagSets) {
  const b = await chromium.launch({ args });
  const p = await b.newPage();
  await p.goto("http://localhost:3100/", { waitUntil: "domcontentloaded" }).catch(() => p.goto("about:blank"));
  const r = await p.evaluate(async () => {
    const has = typeof window.BarcodeDetector === "function";
    let formats = null;
    if (has) { try { formats = await window.BarcodeDetector.getSupportedFormats(); } catch (e) { formats = "throw " + e; } }
    return { url: location.href, has, formats, secure: window.isSecureContext };
  });
  console.log(JSON.stringify(args), "->", JSON.stringify(r));
  await b.close();
}
