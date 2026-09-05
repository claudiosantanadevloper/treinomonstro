const CACHE       = 'monstro-v26';
const MEDIA_CACHE = 'monstro-media-v1';
const MEDIA_MAX   = 20;

const LOCAL_ASSETS = [
  './',
  './index.html',
  './instalar.html',
  './manifest.json',
  './icons/icon.svg',
  './src/app.js',
  './src/styles/main.css',
  './src/store/store.js',
  './src/store/persistedKeys.js',
  './src/utils/dom.js',
  './src/utils/format.js',
  './src/utils/labels.js',
  './src/services/StorageService.js',
  './src/services/TimerService.js',
  './src/services/ExportService.js',
  './src/services/ThemeService.js',
  './src/services/PDFImportService.js',
  './src/components/Sharingan.js',
  './src/components/CyberBody.js',
  './src/data/quotes.js',
  './src/data/workouts.js',
  './src/data/cardioProtocols.js',
  './src/data/achievements.js',
  './src/data/exerciseLibrary.js',
  './src/views/HomeView.js',
  './src/views/DashboardView.js',
  './src/views/WorkoutView.js',
  './src/views/WorkoutEditorView.js',
  './src/views/AnalyticsView.js',
  './src/views/ProfileView.js',
  './src/views/SettingsView.js',
  './src/views/CardioView.js',
  './src/views/BattleReportView.js',
  './src/views/OnboardingView.js',
  './src/data/workoutTemplates.js',
  './src/data/exerciseMedia.js',
  './src/controllers/AppController.js',
  './src/controllers/WorkoutController.js',
  './src/controllers/CardioController.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(LOCAL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== MEDIA_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Recursos externos (CDN): rede primeiro, cache como fallback
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Em localhost/ngrok: sempre rede (evita servir JS stale durante dev/testes mobile)
  const isDevHost = self.location.hostname === 'localhost' ||
                    self.location.hostname.endsWith('.ngrok-free.app') ||
                    self.location.hostname.endsWith('.ngrok-free.dev') ||
                    self.location.hostname.endsWith('.ngrok.app') ||
                    self.location.hostname.endsWith('.ngrok.io');
  if (isDevHost) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Mídia de exercícios: stale-while-revalidate com LRU de 20 entradas
  if (url.pathname.includes('/media/exercises/')) {
    e.respondWith(
      caches.open(MEDIA_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then(async res => {
          if (res.ok) {
            await cache.put(request, res.clone());
            // LRU: mantém apenas MEDIA_MAX entradas
            const keys = await cache.keys();
            if (keys.length > MEDIA_MAX) {
              await Promise.all(keys.slice(0, keys.length - MEDIA_MAX).map(k => cache.delete(k)));
            }
          }
          return res;
        }).catch(() => cached ?? new Response('', { status: 404 }));
        return cached ?? fetchPromise;
      })
    );
    return;
  }

  // Recursos locais: cache primeiro
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      });
    })
  );
});
