// 우리 반 포털 서비스 워커: 홈 화면 설치(PWA)와, 한 번 연 화면을 빨리 다시 띄우기 위한 저장
// - 페이지(HTML)는 늘 서버에서 새로 받고, 안 될 때만 저장본을 씀 → 새 버전이 바로 반영됨
// - 빌드된 파일(assets/)은 이름에 내용 지문이 붙어 있어 저장본을 그대로 씀
// - Firebase 등 다른 주소로 가는 요청은 건드리지 않음
const CACHE = 'cp-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }
  if (url.pathname.includes('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
