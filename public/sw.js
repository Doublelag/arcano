// Service worker de Arcano: red primero y caché como respaldo sin conexión.
// Sube la versión solo si quieres forzar a borrar la caché vieja.
const CACHE = 'arcano-v1';

const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'game.js',
  'music.js',
  'biomes.js',
  'manifest.webmanifest',
  'icons/icon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'assets/doublelag-logo.png'
];

// Quita la marca de "redirigida" (Cloudflare manda /index.html -> /);
// una respuesta redirigida no se puede servir a una navegación.
async function limpia(res) {
  if (!res.redirected) return res;
  const cuerpo = await res.blob();
  return new Response(cuerpo, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Uno a uno: si falta un archivo no se cae toda la instalación
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, await limpia(res));
      } catch (_) { /* sin red: se rellenará al jugar */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    let res;
    try {
      res = await fetch(req);
    } catch (err) {
      // Sin conexión: tira de la caché
      return (await desdeCache(req)) || Response.error();
    }
    // Guarda cada respuesta buena para tenerla sin conexión
    if (res.status === 200 && res.type === 'basic') {
      const copia = res.clone();
      e.waitUntil((async () => {
        try {
          const cache = await caches.open(CACHE);
          await cache.put(req, await limpia(copia));
        } catch (_) { /* caché llena o no disponible */ }
      })());
      return res;
    }
    // Servidor caído (5xx): mejor la copia guardada que una pantalla de error
    if (res.status >= 500) return (await desdeCache(req)) || res;
    return res;
  })());
});

// Copia guardada de una petición (sin query y, si es una página, la portada)
async function desdeCache(req) {
  const cache = await caches.open(CACHE);
  let hit = await cache.match(req);
  if (!hit) hit = await cache.match(req, { ignoreSearch: true });
  if (!hit && req.mode === 'navigate') hit = (await cache.match('./')) || (await cache.match('index.html'));
  return hit;
}
