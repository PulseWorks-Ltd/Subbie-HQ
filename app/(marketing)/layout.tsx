import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // No min-h-screen/flex-1 stretch here — that forced every page to be at
  // least one viewport tall, leaving a large blank gap above the footer
  // on shorter pages (industry/comparison/guide). The footer should
  // follow content directly regardless of page length.
  //
  // bg-surface-deep/text-on-surface here (2026-09 redesign) is what makes
  // every marketing page dark by default without each page repeating it —
  // deliberately not gated behind `dark:`, see tailwind.config.cjs's
  // comment on why the marketing site's theme is decoupled from the
  // authenticated app's own light/dark toggle.
  return (
    <div className="flex flex-col bg-surface-deep text-on-surface font-display">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
