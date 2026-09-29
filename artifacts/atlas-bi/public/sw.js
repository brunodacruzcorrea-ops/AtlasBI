// Service worker minimo: deixa o app instalavel e abrir o casco offline.
// Nunca guarda respostas da API — comissao e dado financeiro e precisa vir
// sempre do servidor.
const CACHE = "niadcon-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }
  // Rede primeiro; o cache so entra quando esta offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "./" : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? "./" : req)),
  );
});
