import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { auth } from "@/auth";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Subbie HQ",
  description: "Contract, scope, programme and payment tracking for subcontractors."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background-light text-[#0d141b] dark:bg-background-dark dark:text-slate-50 min-h-screen">
        <AuthProvider>
          {session?.user && <TopNav userName={session.user.name ?? null} userEmail={session.user.email ?? ""} />}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
