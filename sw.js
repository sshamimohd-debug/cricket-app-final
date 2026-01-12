const CACHE = "mpl-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/theme.css",
  "./js/utils.js",
  "./js/router.js",
  "./js/ui.js",
  "./js/data-seed.js",
  "./js/app.js",
  "./data/tournament.json",
  "./pages/home.html",
  "./pages/match.html",
  "./pages/scorecard.html",
  "./pages/points.html",
  "./pages/teams.html",
  "./pages/knockouts.html",
  "./pages/rules.html"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null)))
  );
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached=>{
      return cached || fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(cache=>cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=>cached);
    })
  );
});
