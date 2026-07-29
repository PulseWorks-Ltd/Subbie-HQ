import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { PushNotificationsButton } from "@/components/mobile/push-notifications-button";
import { ServiceWorkerRegistration } from "@/components/mobile/service-worker-registration";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    // Preserve callbackUrl so login sends the user back into the scoped
    // mobile shell — without it, the post-login redirect falls back to "/"
    // (the full app), which only self-corrects after a hard reload re-runs
    // this layout check with a real session.
    redirect("/login?callbackUrl=/m");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ServiceWorkerRegistration />
      {/* public/manifest.webmanifest carries an explicit "id" — Chrome/Android
          key "is this already installed" off manifest id (defaulting to
          start_url when absent), tracked at the OS/WebAPK level, independent
          of browser profile or incognito. Any device that installed an
          earlier build (identity defaulted to start_url "/m") is permanently
          treated as "already installed" and never re-offered the install
          prompt. Bump the id's query value again if this recurs. */}
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#137fec" />
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-[#e7edf3] dark:border-slate-800 px-4 py-3">
        <a href="/m" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-light.png" alt="" className="size-7 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="" className="size-7 hidden dark:block" />
          <span className="text-base font-bold">Subbie HQ</span>
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <PushNotificationsButton />
          <form
            action={async () => {
              "use server";
              // Without callbackUrl, logging back in lands on "/" (the full
              // desktop app, all nav tabs) instead of back in the scoped
              // mobile shell — the exact "shows full desktop view after
              // logging out and back in" symptom.
              await signOut({ redirectTo: "/login?callbackUrl=/m" });
            }}
          >
            <button className="text-xs font-medium text-[#4c739a] dark:text-slate-400">Sign out</button>
          </form>
        </div>
      </header>
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
