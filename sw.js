// Service worker: la app entera funciona sin conexión una vez visitada.
//
// Estrategia stale-while-revalidate: se sirve de la caché al instante y se refresca
// por detrás, así una partida en el campo no depende de la cobertura y las mejoras
// llegan en la siguiente apertura. Subir VERSION invalida la caché entera.
const VERSION = 'bbweb-v4';

const APP = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './src/ui/app.js', './src/enlace.js',
  './src/engine/dice.js', './src/engine/heridas.js', './src/engine/equipo.js',
  './src/engine/tablero.js', './src/engine/partido.js', './src/engine/balon.js',
  './src/engine/derribo.js', './src/engine/movimiento.js', './src/engine/placaje.js',
  './src/engine/pase.js', './src/engine/falta.js', './src/engine/secuencia.js',
  './src/data/equipos.js', './src/data/habilidades.js', './src/data/nombres.es.js',
  './src/data/rosters-iniciales.js', './src/data/formaciones.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      const enCache = await c.match(e.request, { ignoreSearch: url.pathname.endsWith('/') });
      const red = fetch(e.request).then((r) => {
        if (r.ok) c.put(e.request, r.clone());
        return r;
      }).catch(() => enCache);
      return enCache ?? red;
    }),
  );
});
