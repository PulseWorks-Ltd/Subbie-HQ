import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { PushNotificationsButton } from "@/components/mobile/push-notifications-button";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#137fec" />
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-[#e7edf3] dark:border-slate-800 px-4 py-3">
        <a href="/m" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-light.png" alt="" className="size-7 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="" className="size-7 hidden dark:block" />
          <span className="text-base font-bold">Subbie Updates</span>
        </a>
        <div className="flex items-center gap-3">
          <PushNotificationsButton />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
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
