// 달빛암 서비스 워커: 홈 화면 설치용. 화면 파일은 항상 최신으로 받아오고, 인터넷이 끊기면 저장해 둔 것을 보여 줘요.
const CACHE = "dalbitam-v28";
const CORE = ["./", "index.html", "style.css", "main.js", "i18n.js", "config.js", "manifest.json", "icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
