import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Get Sign-Off Without Chasing a Signature | Subbie HQ",
  description:
    "Send a Variation Package for approval with a secure link the Main Contractor can act on without a login — and, if you want, let it send itself on schedule."
};

export default function ApprovalsAutomationPage() {
  return (
    <FeaturePageView
      h1="Get Sign-Off Without Chasing a Signature"
      problem="You've built the Variation Package. It's accurate, it's evidenced, it's ready. Now it sits in an inbox waiting for someone at the Main Contractor's office to open it, read it, and actually respond — which usually means a phone call, then another one."
      consequence="Cash flow stalls on paperwork, not on disputed work. The claim isn't wrong. Nobody's actually said no. It's just sitting there, and every day it sits there is a day further from getting paid."
      helps={[
        "Send the Package with a secure link — no account, no password, nothing for the Main Contractor to set up. They open it, see exactly what's being asked (the value, what's changed since the last request, the evidence behind it), and Approve, Reject, or Comment directly. The same mechanism works for Acknowledging an Update, Confirming a Day Works Sheet, or getting something Signed off — always a recorded acknowledgement of what was sent, never presented as a legally binding electronic signature.",
        "Every request is tracked from send to response: pending, responded, or expired, right there on the item. No more wondering whether it was actually seen.",
        "If your submission deadline is the same every month, you can automate the whole cycle. Manual (the default) changes nothing. Automatic with Approval generates the Package and warns your team 2 working days before the real deadline, with time to review — and cancel, with one click — before anything goes out. Fully Automatic generates and sends on the day with no review step at all, for teams who've confirmed the recipient list and trust the cycle completely."
      ]}
      outcome="A Variation Package goes out, gets seen, and gets a real answer — approved, rejected, or automatically sent on schedule — without a chasing phone call in between."
    />
  );
}
