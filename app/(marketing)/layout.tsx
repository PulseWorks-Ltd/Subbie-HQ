import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // No min-h-screen/flex-1 stretch here — that forced every page to be at
  // least one viewport tall, leaving a large blank gap above the footer
  // on shorter pages (industry/comparison/guide). The footer should
  // follow content directly regardless of page length.
  return (
    <div className="flex flex-col">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
