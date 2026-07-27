import { auth } from "@/auth";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <>
      {session?.user && <TopNav userName={session.user.name ?? null} userEmail={session.user.email ?? ""} />}
      {children}
    </>
  );
}
