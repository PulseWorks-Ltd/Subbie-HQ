"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not reset your password. Please try again.");
      return;
    }

    router.push("/login?reset=success");
  }

  if (!token) {
    return (
      <InvalidLinkNotice message="This reset link is missing its token. Please request a new one." />
    );
  }

  if (error === "This reset link is no longer valid. Please request a new one.") {
    return <InvalidLinkNotice message={error} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-light.png" alt="Subbie HQ" className="size-12 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="Subbie HQ" className="size-12 hidden dark:block" />
        </Link>
        <h1 className="text-xl font-bold mb-1">Choose a new password</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">Must be at least 8 characters.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            New password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Confirm new password
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function InvalidLinkNotice({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-light.png" alt="Subbie HQ" className="size-12 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="Subbie HQ" className="size-12 hidden dark:block" />
        </Link>
        <h1 className="text-xl font-bold mb-1">Link no longer valid</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">{message}</p>
        <Link
          href="/forgot-password"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold px-4 hover:bg-primary/90"
        >
          Request a new link
        </Link>
      </div>
    </div>
  );
}
