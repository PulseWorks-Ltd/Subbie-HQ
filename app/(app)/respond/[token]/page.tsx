import { ExternalActionResponseForm } from "@/components/external-actions/external-action-response-form";

// Genuinely public — no auth check here or anywhere in the component tree
// below (see lib/external-action.ts's getExternalActionForToken for what
// this token can and can't reveal). Same placement pattern as the existing
// /invite/[token] page: living under the (app) route group doesn't require
// a session — app/(app)/layout.tsx already renders no nav and applies no
// gating when there's no session.
export default async function RespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <ExternalActionResponseForm token={token} />
      </div>
    </div>
  );
}
