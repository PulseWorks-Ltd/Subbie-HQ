"use client";

import { useEffect, useState } from "react";

// Shared install-eligibility detection, used by both the dismissible
// InstallPrompt banner and the always-visible InstallAppButton in the
// header — split out so there's exactly one place that listens for
// beforeinstallprompt and detects standalone/iOS, rather than two
// components independently wiring the same browser APIs (and risking them
// drifting, e.g. one checking display-mode differently than the other).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  // Defaults true (not false) so nothing install-related ever flashes on
  // screen before this effect has had a chance to run and actually check —
  // an already-installed user briefly seeing an "Install app" control
  // would be a worse false positive than a not-yet-installed user briefly
  // seeing nothing for one render.
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));

    if (standalone) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  // Returns true if the real one-tap browser prompt was actually shown,
  // false if there was nothing to prompt (caller should fall back to
  // manual instructions — see InstallAppButton).
  async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return true;
  }

  return { isStandalone, isIos, canPromptInstall: Boolean(deferredPrompt), promptInstall };
}
