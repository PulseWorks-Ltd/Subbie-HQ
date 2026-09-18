"use client";

import { useState } from "react";
import { useInstallPrompt } from "./use-install-prompt";

// Always reachable (unlike InstallPrompt, the dismissible banner on
// app/m/page.tsx) — lives in the header on every /m page so "how do I
// install this" is never fully unreachable just because someone dismissed
// the banner (2026-09 fix: the banner's dismiss used to be the ONLY way to
// find install instructions, and dismissing it snoozes it for two weeks —
// this closes that gap without needing to touch the banner's own snooze
// behaviour). Hidden once actually installed (isStandalone), same as the
// banner.
export function InstallAppButton() {
  const { isStandalone, isIos, canPromptInstall, promptInstall } = useInstallPrompt();
  const [showManualSteps, setShowManualSteps] = useState(false);

  if (isStandalone) return null;

  async function handleClick() {
    // If the browser has a real one-tap prompt ready, use it directly —
    // manual steps are only ever the fallback for when that's unavailable
    // (iOS, or a browser/session that hasn't offered beforeinstallprompt).
    const prompted = await promptInstall();
    if (!prompted) setShowManualSteps((current) => !current);
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        title="Install app"
        aria-label="Install app"
        className="flex items-center justify-center size-8 rounded-full text-[#4c739a] dark:text-slate-400 hover:bg-[#e7edf3] dark:hover:bg-slate-800"
      >
        <span className="material-symbols-outlined text-xl">install_mobile</span>
      </button>
      {showManualSteps && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs shadow-lg z-50">
          {isIos ? (
            <p>
              Tap the Share icon <span className="font-bold">⬆</span>, then{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Add to Home Screen</span>.
            </p>
          ) : (
            <p>
              Tap the <span className="font-bold">⋮</span> menu and choose{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Install app</span> or{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Add to Home screen</span>.
            </p>
          )}
          <button
            onClick={() => setShowManualSteps(false)}
            className="mt-2 text-[#4c739a] dark:text-slate-400 font-medium"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
