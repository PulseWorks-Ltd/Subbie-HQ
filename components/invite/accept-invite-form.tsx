"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";

type InviteDetails = {
  email: string;
  title: string | null;
  organisationName: string;
};

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setLoadError(body.error ?? "This invite link is invalid or has expired.");
          return;
        }
        setInvite(body.invite);
        setHasExistingAccount(body.hasExistingAccount);
      })
      .catch(() => setLoadError("Could not load this invite."));
  }, [token]);

  const isLoggedInAsInvitee =
    sessionStatus === "authenticated" && session?.user?.email?.toLowerCase() === invite?.email.toLowerCase();

  async function handleAcceptExisting() {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not accept this invite.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleCreateAccount(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not accept this invite.");
      setIsSubmitting(false);
      return;
    }

    const result = await signIn("credentials", { email: invite!.email, password, redirect: false });
    setIsSubmitting(false);

    if (result?.error) {
      setError("Account created — please sign in.");
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loadError) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-1">Invite not available</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">{loadError}</p>
      </div>
    );
  }

  if (!invite) {
    return <p className="text-sm text-[#4c739a] dark:text-slate-400">Loading invite...</p>;
  }

  if (hasExistingAccount && !isLoggedInAsInvitee) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-1">Join {invite.organisationName}</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">
          An account already exists for {invite.email}. Please log in, then open this invite link again to accept it.
        </p>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          className="block w-full text-center h-10 leading-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (hasExistingAccount && isLoggedInAsInvitee) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-1">Join {invite.organisationName}</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">
          {invite.title ? `You've been invited as ${invite.title}. ` : ""}
          Accept to join this organisation with your existing account.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          onClick={handleAcceptExisting}
          disabled={isSubmitting}
          className="w-full h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Joining..." : "Accept invite"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Join {invite.organisationName}</h1>
      <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">
        {invite.title ? `You've been invited as ${invite.title}. ` : ""}
        Set a password to create your account and join.
      </p>

      <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            disabled
            value={invite.email}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-[#f6f7f8] dark:bg-slate-800 px-3 text-sm text-[#4c739a]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Your name
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Accept invite & create account"}
        </button>
      </form>
    </div>
  );
}
