"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/get-app/copy-link-button";
import { IncomingEmailCard } from "@/components/incoming-emails/incoming-email-card";
import { IncomingEmailReviewDialog } from "@/components/incoming-emails/incoming-email-review-dialog";

export type IncomingEmailAttachment = { id: string; fileName: string; contentType: string };
export type IncomingEmailRow = {
  id: string;
  sender: string;
  ccAddresses: string[];
  subject: string;
  body: string;
  receivedAt: Date;
  suggestedProject: { id: string; name: string } | null;
  suggestedProjectConfidence: number | null;
  suggestedType: string | null;
  suggestedVariationItem: { id: string; reference: string; title: string } | null;
  aiSummary: string | null;
  classificationError: string | null;
  attachments: IncomingEmailAttachment[];
};
export type ProjectOption = {
  id: string;
  name: string;
  variationItems: { id: string; reference: string; title: string }[];
};

export function IncomingEmailsView({
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

  function handleDone() {
    setReviewingEmailId(null);
    router.refresh();
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Incoming Emails</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-1">
          Every email forwarded or CC'd to your Subbie HQ inbox lands here first — nothing is filed anywhere until
          you review and approve it.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl p-5">
        <p className="text-sm font-bold mb-1">Your inbox address</p>
        {inboundAddress ? (
          <>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Forward or CC any relevant email to this address — variations, site instructions, programme changes,
              anything worth keeping on record — and it'll show up below for you to review.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="flex-1 text-left text-sm bg-[#f6f7f8] dark:bg-slate-800 rounded-lg px-3 py-2 truncate">
                {inboundAddress}
              </code>
              <CopyLinkButton url={inboundAddress} />
            </div>
          </>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">
            Incoming Emails isn't fully configured yet — INBOUND_EMAIL_DOMAIN is missing. Contact an admin to finish
            setup.
          </p>
        )}
      </div>

      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e7edf3] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">Nothing to review</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Forwarded emails will appear here once they arrive.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
    </main>
  );
}
