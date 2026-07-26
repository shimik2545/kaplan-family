/* Service Worker — ניהול הבית
   מאפשר לאפליקציה לעבוד אופליין כשמותקנת במסך הבית.
   - קריאות ל-Supabase לעולם לא נתפסות/נשמרות במטמון (תמיד רשת).
   - מסמך ה-HTML: רשת-תחילה (כדי לקבל עדכונים), נפילה למטמון באופליין.
   - שאר הקבצים (תמונות/אייקונים): מטמון-תחילה.
*/
const CACHE = 'beithaim-v2';
const ASSETS = [
  './',
  './index.html',
  './shabat.png',
  './hag.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase — תמיד רשת, בלי מטמון
  if (url.hostname.endsWith('supabase.co')) return;
  // version.json — תמיד רשת, לעולם לא מטמון.
  // בלי זה, המטמון (cache-first) היה מקפיא את הגרסה על ערך ישן ובאנר-העדכון לא היה מופיע לאף אחד.
  if (url.pathname.endsWith('version.json')) return;
  // מקורות חיצוניים אחרים — התנהגות רגילה
  if (url.origin !== location.origin) return;

  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    // רשת-תחילה למסמך
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
  } else {
    // מטמון-תחילה לשאר הקבצים
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }))
    );
  }
});
