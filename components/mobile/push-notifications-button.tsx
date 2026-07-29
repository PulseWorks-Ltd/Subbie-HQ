"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "unsupported" | "idle" | "subscribing" | "subscribed" | "denied" | "error";

export function PushNotificationsButton() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker.getRegistration("/m/").then((registration) => {
      registration?.pushManager.getSubscription().then((subscription) => {
        if (subscription) setStatus("subscribed");
      });
    });
  }, []);

  async function handleEnable() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setStatus("error");
      return;
    }

    setStatus("subscribing");

    try {
      // The service worker is registered eagerly on page load (see
      // components/mobile/service-worker-registration.tsx) — just wait for
      // it here rather than re-registering.
      const registration = await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });

      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  }

  if (status === "unsupported") return null;

  if (status === "subscribed") {
    return (
      <span className="text-[11px] font-medium text-green-600 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">notifications_active</span>
      </span>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={status === "subscribing" || status === "denied"}
      title={status === "denied" ? "Notifications blocked in browser settings" : "Enable notifications"}
      className="text-[11px] font-medium text-[#4c739a] dark:text-slate-400 disabled:opacity-50"
    >
      {status === "subscribing" ? "..." : status === "denied" ? "Notifications blocked" : "Enable notifications"}
    </button>
  );
}
