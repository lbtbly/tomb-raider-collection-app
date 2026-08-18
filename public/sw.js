// Vitrine's service worker. Offline is a product requirement (PLAN.md), not
// an optimisation: this precaches the app shell at install, then
// runtime-caches everything same-origin as it is actually fetched, so a
// cold open with the network disabled still reaches a verdict (F10), and
// every route -- including a dynamic one such as a specific collection
// item, visited once while online before this -- renders its designed
// screen offline instead of the browser's own offline error page (F16).
//
// No build-time asset manifest: Turbopack's hashed /_next/static chunk
// filenames are not knowable to a hand-written file like this one ahead of
// a specific build. Those are cached the first time each is actually
// requested (immutable per build; a new build ships new filenames under a
// new CACHE_VERSION below, so nothing here needs to invalidate a single
// asset by name). Validated against `npm run build && npm run start`: dev
// mode's Turbopack asset pipeline is known to fight a service worker
// (.forge dispatch note), so this is not exercised under `next dev`.

const CACHE_VERSION = "vitrine-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Every offline route PLAN.md's offline boundary names that has one shell
// regardless of which device or account is looking at it: CHECK,
// COLLECTION and the offline catalogue index all render entirely from the
// on-device stores on the client once this HTML and its JS have loaded, so
// there is nothing per-user in the shell itself to leak by precaching it.
const SHELL_URLS = ["/", "/collection", "/catalogue", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL_URLS.map((url) =>
          fetch(url, { cache: "no-store" })
            .then((res) => {
              if (res.ok) return cache.put(url, res.clone());
              return undefined;
            })
            .catch(() => {
              // Install itself failing offline (the very first load
              // happening to be offline already) is not fatal: runtime
              // caching below still covers each of these the next time it
              // loads online, same as any route never visited yet.
            }),
        ),
      ),
    ),
  );
  // Activate immediately rather than waiting for every open tab of the
  // previous worker to close, so a deploy that fixes an offline defect
  // reaches a device on its very next load, not its next full restart.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("vitrine-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept");
  return request.method === "GET" && !!accept && accept.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept a write; the outbox owns retry semantics for those
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // R20/R25: nothing here ever routes a third-party host
  if (url.pathname.startsWith("/api/")) return; // /api/sync/* carries writes and the delta cursor; never answered from a stale cache

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(async () => {
          // Offline. Exact URL first (this route, visited before, while
          // online -- what F12/F13 actually require), then the pathname
          // alone (a precached shell route stored by its bare path), then
          // the app shell itself so the worst case is still the designed
          // app rather than a browser error page (F16).
          //
          // THE THIRD FALLBACK DOES NOT ROUTE. This comment used to claim
          // React hydrates "this pathname's own client route" from the
          // shell. Measured on 2026-08-18: it does not. The shell IS the
          // check screen's document, and React hydrates what the document
          // contains rather than what the address implies, so
          // /no-such-route and a never-visited /collection/{id} both come
          // back reading "Aisle check" with the requested address still in
          // the URL bar. Online the same two render "That page is not
          // here." and "This copy is not on this device."
          //
          // F16 counts routes rendering a BROWSER DEFAULT and the check
          // screen is a designed screen, so F16 stands at 0 and this is not
          // a rubric failure. It is still wrong for a collector, who
          // follows a stale link offline and gets a working screen with no
          // indication the address was dead. Fixing it means serving a
          // not-found document for unmatched addresses, or having the shell
          // read its own location and route client-side. Both change the
          // offline boundary PLAN.md treats as load bearing, so measure the
          // cold-open figure F10 rests on before and after.
          const cached =
            (await caches.match(request)) ||
            (await caches.match(url.pathname)) ||
            (await caches.match("/"));
          return cached || Response.error();
        }),
    );
    return;
  }

  // Same-origin static assets (Next/Turbopack build output, the
  // self-hosted fonts, the icon): cache-first, since a new build always
  // ships new hashed filenames under a new CACHE_VERSION rather than
  // mutating an old one in place.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
