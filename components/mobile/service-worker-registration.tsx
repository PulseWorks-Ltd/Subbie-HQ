"use client";

import { useEffect } from "react";

// Registers the service worker unconditionally as soon as the mobile shell
// loads — this used to only happen inside push-notifications-button.tsx's
// "Enable notifications" click handler, which meant the app was never
// actually installable (no controlling service worker = Chrome won't fire
// `beforeinstallprompt`) until a user separately opted into push, an
// unrelated action almost nobody takes before trying to install. Rendered
// once in app/m/layout.tsx so it applies across the whole /m shell.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/m/" }).catch(() => {});
  }, []);

  return null;
}
