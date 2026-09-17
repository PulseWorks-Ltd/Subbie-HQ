// Minimal service worker for the Subbie HQ mobile PWA.
// Scope is restricted to /m at registration time (see
// components/mobile/service-worker-registration.tsx), even though this file
// is served from the origin root.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No caching strategy — just a network passthrough. Some browsers still use
// "has a fetch handler" as a PWA-installability signal even though it's no
// longer a hard requirement in modern Chrome.
//
// Same-origin only (2026-09 fix): this used to re-issue every request,
// including cross-origin ones (e.g. app/layout.tsx's Material Symbols icon
// font, loaded from fonts.googleapis.com/fonts.gstatic.com). This service
// worker has no caching strategy for cross-origin requests anyway — it was
// only ever passing them through — but doing that via its own
// fetch(event.request) put them through the service worker's own fetch
// pipeline instead of the page's normal subresource loading, which broke
// the icon font under this app's CSP (every icon rendered as its raw
// ligature text, e.g. "mic", "dark_mode", on every /m page). Leaving a
// cross-origin request alone (not calling respondWith at all) lets the
// browser handle it exactly as if no service worker existed.
self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Subbie Updates", body: event.data.text() };
  }

  const title = payload.title || "Subbie Updates";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/m" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/m";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
