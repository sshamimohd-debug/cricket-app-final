// MPGB PL Service Worker (network-first for HTML/JS/CSS to avoid stale deployments)
const CACHE_VERSION = "mpl-cache-v3";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/theme.css",
  "./css/theme-dark.css",
  "./js/app.js",
  "./js/router.js",
  "./js/ui.js",
  "./js/utils.js",
  "./js/firebase.js",
  "./admin/index.html",
  "./admin/scorer.html",
  "./admin/admin.js",
  "./admin/scorer.js",
  "./pages/home.html",
  "./pages/match.html",
  "./pages/scorecard.html",
  "./pages/points.html",
  "./pages/teams.html",
  "./pages/knockouts.html",
  "./pages/rules.html",
  "./data/tournament.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).catch(()=>{})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_VERSION ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  try{
    const fresh = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, fresh.clone()).catch(()=>{});
    return fresh;
  }catch(e){
    const cached = await caches.match(request);
    if(cached) return cached;
    throw e;
  }
}

async function cacheFirst(request){
  const cached = await caches.match(request);
  if(cached) return cached;
  const fresh = await fetch(request);
  const cache = await caches.open(CACHE_VERSION);
  cache.put(request, fresh.clone()).catch(()=>{});
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if(url.origin !== location.origin) return;

  // Network-first for navigations and core assets (prevents stale JS/HTML)
  if(req.mode === "navigate" ||
     req.destination === "document" ||
     req.destination === "script" ||
     req.destination === "style"){
    event.respondWith(networkFirst(req));
    return;
  }

  // Cache-first for others (icons/images)
  event.respondWith(cacheFirst(req));
});

self.addEventListener("message", (event)=>{
  if(event.data === "SKIP_WAITING"){
    self.skipWaiting();
  }
});
