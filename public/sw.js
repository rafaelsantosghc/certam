// CERTAM Safe Service Worker (v3)
// Limpa caches legados do Workbox que causavam ERR_FAILED ao recarregar URLs com parâmetros (/?id=...&cargo=...)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Não intercepta requisições de navegação (mode === 'navigate') nem de API,
  // permitindo que o navegador resolva qualquer rota /?id=...&cargo=...&tab=... diretamente sem ERR_FAILED.
  if (!event || !event.request) return;
  return;
});

