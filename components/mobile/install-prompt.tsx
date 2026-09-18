"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "subbie-install-prompt-dismissed";
// Snoozed, not silenced forever (2026-09 fix) — the old version stored a
// plain "1" flag that hid this banner permanently the moment anyone tapped
// the close button, on that browser profile, for good. That's most of why
// pasting the /m URL straight into Chrome kept showing nothing: this page
// gets tested/dismissed a lot during setup, and the very first dismiss
// would have killed it forever afterwards. Now the key stores a timestamp,
// and the banner is only suppressed for two weeks before re-offering.
const DISMISS_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY));
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_SNOOZE_MS) return;

    setIsDismissed(false);
    setIsIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setIsDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (isDismissed) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3 mb-4">
      <span className="material-symbols-outlined text-primary text-2xl shrink-0">install_mobile</span>
      <div className="flex-1 min-w-0">
        {deferredPrompt ? (
          <>
            <p className="text-sm font-bold mb-1">Install this app</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Add Subbie HQ to your home screen for quick, offline-friendly access.
            </p>
            <button
              onClick={handleInstall}
              className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90"
            >
              Install App
            </button>
          </>
        ) : isIos ? (
          <>
            <p className="text-sm font-bold mb-1">Add to Home Screen</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">
              Tap the Share icon <span className="font-bold">⬆</span>, then{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Add to Home Screen</span>.
            </p>
          </>
        ) : (
          // The browser hasn't (yet) fired beforeinstallprompt — happens if
          // it's still evaluating installability, this is a browser that
          // doesn't support the prompt event (e.g. Firefox for Android), or
          // this is an in-app/WebView browser from a QR-scanner or camera
          // app. Give explicit manual steps instead of showing nothing.
          <>
            <p className="text-sm font-bold mb-1">Add to Home Screen</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">
              Open this page in Chrome, then tap the <span className="font-bold">⋮</span> menu and choose{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Install app</span> or{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Add to Home screen</span>.
            </p>
          </>
        )}
      </div>
      <button onClick={dismiss} className="text-[#4c739a] dark:text-slate-400 shrink-0">
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
}
