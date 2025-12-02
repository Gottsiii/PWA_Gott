// Nombre de la caché y versión (cambiar esto fuerza la actualización del SW y el recacheo)
const CACHE_NAME = 'fracciones-pwa-cache-v1';

// Recursos estáticos que se deben precachear (funcionalidad Offline)
const urlsToCache = [
    '/', // El HTML principal (index.html)
    'index.html',
    'https://cdn.tailwindcss.com', // Tailwind
    // Si se usaran imágenes locales, irían aquí.
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// --- Etapa de Instalación (Instalación del Service Worker y Precaching) ---
self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando y precacheando recursos...');
    // Espera hasta que el precaching se haya completado
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Precaching completo.');
                return cache.addAll(urlsToCache);
            })
            // Forzar que el nuevo Service Worker tome el control inmediatamente
            .then(() => self.skipWaiting())
    );
});

// --- Etapa de Activación (Limpieza de cachés antiguas) ---
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activando...');
    const cacheWhitelist = [CACHE_NAME];
    
    // Limpiar cachés antiguas
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Tomar el control de la página inmediatamente
    );
});

// --- Etapa de Fetch (Estrategia de Caching: Cache-First) ---
self.addEventListener('fetch', event => {
    // Evitar interceptar llamadas a la API de Firebase/Gemini
    if (event.request.url.includes('googleapis.com') || event.request.url.includes('firebase')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si encontramos una respuesta en la caché, la devolvemos inmediatamente
                if (response) {
                    console.log('[Service Worker] Sirviendo desde caché:', event.request.url);
                    return response;
                }
                
                // Si no está en caché, hacemos una solicitud a la red
                console.log('[Service Worker] Red, no en caché:', event.request.url);
                return fetch(event.request).then(
                    response => {
                        // Comprobar si recibimos una respuesta válida
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // CLONAR la respuesta antes de ponerla en caché
                        const responseToCache = response.clone();

                        // Abrir la caché y guardar el nuevo recurso
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});


// --- Etapa de Notificaciones Push (Mock/Conceptual) ---
// Esto se programa en el SW para que las notificaciones funcionen incluso cuando la app está cerrada.

self.addEventListener('push', event => {
    const title = '¡Notificación de Fracciones PWA!';
    const options = {
        body: event.data.text() || 'Es hora de practicar fracciones y números mixtos.',
        icon: 'https://placehold.co/192x192/2563EB/ffffff?text=F',
        badge: 'https://placehold.co/192x192/2563EB/ffffff?text=F',
        vibrate: [200, 100, 200],
        data: { url: '/' }
    };

    console.log('[Service Worker] Push recibido. Mostrando notificación.');
    event.waitUntil(self.registration.showNotification(title, options));
});

// Manejar el clic en la notificación
self.addEventListener('notificationclick', event => {
    event.notification.close();
    console.log('[Service Worker] Click en notificación. Abriendo ventana principal.');

    // Abrir la URL definida en los datos, o la raíz
    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Si la app ya está abierta, la enfocamos y navegamos a la URL
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si la app no está abierta, abrimos una nueva ventana
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});