"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    // Same generic confirmation shown regardless of the actual response —
    // the API already always returns the identical message either way, but
    // the UI itself never branches on the result either, as a second layer
    // against ever accidentally revealing account existence.
    setIsSubmitting(false);
    setSubmitted(true);
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

        {submitted ? (
          <>
            <h1 className="text-xl font-bold mb-1">Check your email</h1>
            <p className="text-sm text-[#4c739a] dark:text-slate-400">
              If an account exists for that email, we&apos;ve sent a reset link. It expires in 1 hour.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1">Forgot your password?</h1>
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm text-[#4c739a] dark:text-slate-400">
          <Link href="/login" className="text-primary font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
