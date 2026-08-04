"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/get-app/copy-link-button";
import { IncomingEmailCard } from "@/components/incoming-emails/incoming-email-card";
import { IncomingEmailReviewDialog } from "@/components/incoming-emails/incoming-email-review-dialog";
import type { IncomingEmailRow, ProjectOption } from "@/components/incoming-emails/incoming-emails-view";

// Mobile shell around the exact same card/dialog components desktop uses
// (Task 1.3 — "matching desktop behaviour exactly") — only the outer
// layout and polling wiring are mobile-specific; the review dialog's
// editable project/type fields and the approve/dismiss/reclassify actions
// are the identical desktop component and API calls, not a reimplementation.
export function MobileIncomingEmailsView({
  emails,
  projects,
  inboundAddress
}: {
  emails: IncomingEmailRow[];
  projects: ProjectOption[];
  inboundAddress: string | null;
}) {
  const router = useRouter();
  const [reviewingEmailId, setReviewingEmailId] = useState<string | null>(null);
  const reviewingEmail = emails.find((email) => email.id === reviewingEmailId) ?? null;

  // Same fix as desktop's IncomingEmailsView (Task 1.4) — this page is a
  // Server Component fetched once on load, so a newly-forwarded email
  // never appeared without a manual refresh until that fix. Same 20s
  // interval, same pause-while-reviewing behaviour.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!reviewingEmailId) {
        router.refresh();
      }
    }, 20_000);
    return () => clearInterval(interval);
  }, [reviewingEmailId, router]);

  function handleDone() {
    setReviewingEmailId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <a href="/m" className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
          &larr; Your Projects
        </a>
        <h1 className="text-lg font-bold">Incoming Emails</h1>
      </div>

      {inboundAddress ? (
        <div className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold mb-1">Your inbox address</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">
            Forward any email here right from your phone — it'll show up below to review.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-[#f6f7f8] dark:bg-slate-800 rounded-lg px-2 py-2 truncate">
              {inboundAddress}
            </code>
            <CopyLinkButton url={inboundAddress} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">
          Incoming Emails isn't fully configured yet. Contact an admin to finish setup.
        </p>
      )}

      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e7edf3] dark:border-slate-700 py-12">
          <p className="font-bold mb-1 text-sm">Nothing to review</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">Forwarded emails will appear here once they arrive.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {emails.map((email) => (
            <IncomingEmailCard
              key={email.id}
              email={email}
              onReview={() => setReviewingEmailId(email.id)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {reviewingEmail && (
        <IncomingEmailReviewDialog
          email={reviewingEmail}
          projects={projects}
          onClose={() => setReviewingEmailId(null)}
          onFiled={handleDone}
        />
      )}
    </div>
  );
}
