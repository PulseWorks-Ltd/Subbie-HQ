import Image from "next/image";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

function StepIcon({ icon }: { icon: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-accent-electric mb-2">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
  );
}

function SectionKicker({ children }: { children: string }) {
  return (
    <div className="text-center mb-8">
      <h2 className="font-heading text-3xl font-extrabold tracking-tight text-on-surface mb-2">{children}</h2>
      <div className="w-16 h-1 bg-accent-electric mx-auto rounded-full" />
    </div>
  );
}

export function HomepageView() {
  // No min-h-screen/flex-1 stretch — same fix as app/(marketing)/layout.tsx,
  // kept consistent here since this page renders its own header/footer
  // outside that route group. bg-surface-deep/text-on-surface/font-display
  // repeats that same layout's dark-design tokens since this page bypasses
  // it (see app/(app)/page.tsx — "/" branches on session, so the logged-out
  // homepage renders outside the (marketing) route group entirely).
  return (
    <div className="flex flex-col bg-surface-deep text-on-surface font-display">
      <MarketingHeader />
      <main>
        {/* ============ HERO ============ */}
        <section className="relative px-gutter py-section-gap-sm md:py-section-gap-lg max-w-container-max mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-electric/5 to-transparent rounded-full blur-[120px] -z-10 w-3/4 h-3/4 top-0 left-0" />
          <div className="w-full md:w-1/2 flex flex-col gap-6 z-10">
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface">
              The Work Gets Done. The Money Doesn&apos;t Always Follow.
            </h1>
            <p className="text-lg text-on-surface-variant max-w-2xl">
              Every unproven Site Instruction, every unsigned dayworks sheet, every variation submitted without the
              right evidence is money quietly left on the table. Subbie HQ captures the proof as the job happens, so
              what you&apos;re owed is what you actually get paid — not what you&apos;re still arguing for three
              months later.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              <Link
                href="/signup"
                className="text-center h-11 px-6 flex items-center justify-center rounded-lg bg-accent-electric text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all active:scale-95"
              >
                Start Free Trial
              </Link>
              <Link
                href="#how-subbie-hq-helps"
                className="text-center h-11 px-6 flex items-center justify-center gap-2 rounded-lg border border-outline-variant text-on-surface text-sm font-bold hover:bg-surface-variant transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
                See How It Works
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                <span className="text-sm font-bold text-on-surface">
                  Site Managers approve via a secure link — no app, no login required.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                <span className="text-sm italic text-on-surface-variant">
                  Built specifically for subcontractors — not a main contractor&apos;s compliance tool you got
                  forced onto.
                </span>
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/2 rounded-xl overflow-hidden border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-10">
            <Image
              src="/marketing/hero-site-supervisor.jpg"
              alt="A construction site supervisor in a high-vis vest checking his phone on a building site"
              width={1168}
              height={784}
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="w-full h-auto object-cover"
            />
          </div>
        </section>

        {/* ============ PRODUCT PROOF ============ */}
        {/* Two separate crops of the same real screenshot (not one image
            resized) so mobile/tablet get a tight, legible crop of just the
            Dashboard content instead of the wide desktop screenshot shrunk
            down to illegible text; only lg+ gets the full wide "showcase"
            crop, deliberately wider than the text column above it. */}
        <section className="bg-surface-container py-section-gap-sm md:py-section-gap-lg px-gutter">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-wide text-accent-soft mb-3">Subbie HQ in Action</p>
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface mb-4">
              Know what needs attention across your projects.
            </h2>
            <p className="text-on-surface-variant">
              Subbie HQ brings Site Instructions, project activity and commercial actions into one place, so you
              can see what needs attention before it becomes a problem.
            </p>
          </div>

          <div className="max-w-2xl mx-auto lg:hidden">
            <div className="rounded-2xl border border-white/10 bg-surface-card shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
              <Image
                src="/marketing/dashboard-screenshot-mobile.webp"
                alt="Subbie HQ project dashboard showing Site Instructions and project activity requiring attention"
                width={850}
                height={320}
                sizes="(min-width: 672px) 672px, 100vw"
                className="w-full h-auto"
              />
            </div>
          </div>

          <div className="hidden lg:block max-w-6xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-surface-card shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
              <Image
                src="/marketing/dashboard-screenshot.webp"
                alt="Subbie HQ project dashboard showing Site Instructions and project activity requiring attention"
                width={1697}
                height={380}
                sizes="1152px"
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* ============ THE PROBLEM ============ */}
        <section className="py-section-gap-sm md:py-section-gap-lg px-gutter relative overflow-hidden">
          <div className="max-w-3xl mx-auto text-center flex flex-col gap-6 relative z-10">
            <h2 className="font-heading text-2xl font-bold text-accent-soft">The Problem</h2>
            <h3 className="font-heading text-2xl font-bold text-on-surface">
              Most subcontractors sign contracts they don&apos;t have time to read properly — and do the paperwork
              evenings and weekends, if at all.
            </h3>
            <p className="text-on-surface-variant">
              Large contractors employ Contracts Managers to catch the clause that costs you money, chase the
              evidence a claim needs, and keep a job organised enough to survive a dispute. Most subcontractors
              can&apos;t justify that cost. So the paperwork gets rushed, evidence goes missing, and money gets left
              on the table — not because the work wasn&apos;t done, but because it wasn&apos;t proven.
            </p>
          </div>
        </section>

        {/* ============ YOUR JOB, FROM START TO FINISH ============ */}
        <section className="bg-surface-container py-section-gap-sm md:py-section-gap-lg px-gutter">
          <div className="max-w-container-max mx-auto flex flex-col gap-section-gap-sm">
            <SectionKicker>Your Job, From Start to Finish</SectionKicker>

            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <StepIcon icon="edit_document" />
                <h3 className="font-heading text-xl font-bold text-on-surface">Before You Sign</h3>
                <p className="text-on-surface-variant">
                  Understand what your contract actually expects of you. Identify the commercial risks before
                  you&apos;re committed to them. Know your scope of works and the programme milestones you&apos;re
                  held to — pulled straight from your own documents.
                </p>
              </div>
              <div className="w-full md:w-1/2">
                <div className="bg-surface-card rounded-xl border border-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                  <Image
                    src="/marketing/contract-review-ui.webp"
                    alt="Subbie HQ contract review screen showing a plain-English comparison and flagged risk clauses"
                    width={1162}
                    height={768}
                    sizes="(min-width: 768px) 560px, 100vw"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <StepIcon icon="add_a_photo" />
                <h3 className="font-heading text-xl font-bold text-on-surface">While You&apos;re On Site</h3>
                <p className="text-on-surface-variant">
                  Capture Site Instructions the moment they&apos;re given. Record Updates. Take photos. Upload
                  Dayworks Sheets. Everything organised against the job, from your phone, without a spreadsheet in
                  sight.
                </p>
              </div>
              <div className="w-full md:w-1/2">
                <div className="bg-surface-card rounded-xl border border-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                  <Image
                    src="/marketing/evidence-capture-ui.webp"
                    alt="Subbie HQ mobile evidence capture screen with a live timeline of site activity"
                    width={1408}
                    height={768}
                    sizes="(min-width: 768px) 560px, 100vw"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <StepIcon icon="request_quote" />
                <h3 className="font-heading text-xl font-bold text-on-surface">When It&apos;s Time to Claim</h3>
                <p className="text-on-surface-variant">
                  Build a complete Variation package — instruction, dayworks, materials, photos, correspondence —
                  then send it for approval with a secure link. No app, no login required: the Main Contractor opens
                  it and acts, and you track the response. It&apos;s the evidence base you need to prepare a payment
                  claim with confidence, without digging for anything after the fact.
                </p>
              </div>
              <div className="w-full md:w-1/2">
                <div className="bg-surface-card rounded-xl border border-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                  <Image
                    src="/marketing/variation-builder-ui.webp"
                    alt="Subbie HQ Variation Builder showing three steps: select linked evidence, apply costing, and export the claim package"
                    width={1162}
                    height={768}
                    sizes="(min-width: 768px) 560px, 100vw"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <StepIcon icon="gavel" />
                <h3 className="font-heading text-xl font-bold text-on-surface">When a Dispute Happens</h3>
                <p className="text-on-surface-variant">
                  Every email. Every photo. Every Site Instruction. Every Dayworks Sheet. Every Update. Already
                  organised, already dated, already there.
                </p>
              </div>
              <div className="w-full md:w-1/2">
                <div className="bg-surface-card rounded-xl border border-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                  <Image
                    src="/marketing/dispute-audit-trail-ui.webp"
                    alt="Subbie HQ dispute-proof audit trail showing a verified, timestamped timeline of a disputed variation"
                    width={1408}
                    height={768}
                    sizes="(min-width: 768px) 560px, 100vw"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ HOW SUBBIE HQ HELPS (bento grid) ============ */}
        <section id="how-subbie-hq-helps" className="py-section-gap-sm md:py-section-gap-lg px-gutter">
          <div className="max-w-container-max mx-auto">
            <SectionKicker>How Subbie HQ Helps</SectionKicker>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-surface-card rounded-xl p-6 border border-white/5 hover:border-accent-electric/30 transition-colors">
                <div className="mb-4 text-accent-electric">
                  <span className="material-symbols-outlined text-[32px]">find_in_page</span>
                </div>
                <h4 className="font-bold text-on-surface mb-2">Understand Your Contract Before You Sign</h4>
                <p className="text-sm text-on-surface-variant">
                  Upload your subcontract and get a plain-English breakdown of what&apos;s different from standard
                  terms, what it means for your business, and what to do about it.
                </p>
              </div>

              <div className="bg-surface-card rounded-xl p-6 border border-white/5 hover:border-accent-electric/30 transition-colors">
                <div className="mb-4 text-accent-electric">
                  <span className="material-symbols-outlined text-[32px]">bookmark_added</span>
                </div>
                <h4 className="font-bold text-on-surface mb-2">Never Lose Track of a Site Instruction Again</h4>
                <p className="text-sm text-on-surface-variant">
                  Forward the email the moment it lands. Log a verbal instruction on site. Either way, it&apos;s
                  recorded, timestamped, and ready to turn into a claim.
                </p>
              </div>

              <div className="bg-surface-card rounded-xl p-6 border border-white/5 hover:border-accent-electric/30 transition-colors">
                <div className="mb-4 text-accent-electric">
                  <span className="material-symbols-outlined text-[32px]">timer</span>
                </div>
                <h4 className="font-bold text-on-surface mb-2">Never Lose Labour Costs Again</h4>
                <p className="text-sm text-on-surface-variant">
                  Photograph the dayworks sheet. Confirm the crew, hours, and rate. No re-typing timesheets from
                  memory at the end of the week.
                </p>
              </div>

              <div className="bg-surface-card rounded-xl p-6 border border-white/5 hover:border-accent-electric/30 transition-colors lg:col-span-2 flex flex-col sm:flex-row gap-6 items-center">
                <div className="flex-1">
                  <div className="mb-4 text-accent-electric">
                    <span className="material-symbols-outlined text-[32px]">receipt_long</span>
                  </div>
                  <h4 className="font-bold text-on-surface mb-2">Build Professional Variation Claims in Minutes</h4>
                  <p className="text-sm text-on-surface-variant">
                    One button bundles the instruction, the evidence, and the costing into a document ready to send.
                  </p>
                </div>
                <div className="flex-1 w-full bg-surface-deep rounded-lg p-3 border border-white/5">
                  <div className="h-20 bg-gradient-to-r from-surface-variant to-transparent rounded opacity-50 mb-2" />
                  <div className="h-3 w-3/4 bg-surface-variant rounded mb-2" />
                  <div className="h-3 w-1/2 bg-surface-variant rounded" />
                </div>
              </div>

              <div className="bg-surface-card rounded-xl p-6 border border-white/5 hover:border-accent-electric/30 transition-colors flex gap-4 items-start">
                <div className="w-16 sm:w-20 shrink-0 rounded-lg overflow-hidden border border-white/10">
                  <Image
                    src="/marketing/secure-approval-phone.jpg"
                    alt="A phone screen showing a secure approval request that requires no login"
                    width={784}
                    height={1168}
                    sizes="80px"
                    className="w-full h-auto"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface mb-2">Get Sign-Off Without Chasing a Signature</h4>
                  <p className="text-sm text-on-surface-variant">
                    Site Managers and Main Contractors approve via a secure link — no app, no login required. Track
                    every request from sent to responded, or let the whole monthly cycle send itself.
                  </p>
                </div>
              </div>

              <div className="bg-surface-card rounded-xl p-6 border border-white/5 hover:border-accent-electric/30 transition-colors md:col-span-2 lg:col-span-3 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-accent-electric/5 to-transparent pointer-events-none" />
                <div className="flex-1 z-10">
                  <div className="mb-4 text-accent-electric">
                    <span className="material-symbols-outlined text-[32px]">alarm_on</span>
                  </div>
                  <h4 className="font-bold text-on-surface mb-2">Nothing Quietly Goes Overdue</h4>
                  <p className="text-sm text-on-surface-variant max-w-2xl">
                    Variation and Site Instruction deadlines, H&amp;S document expiry, insurance renewal — staged
                    email and push alerts before anything lapses, not after.
                  </p>
                </div>
                <div className="w-full md:w-auto flex flex-col gap-2 z-10">
                  <div className="bg-surface-deep px-4 py-2 rounded border border-status-warning/30 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-status-warning" />
                    <span className="text-xs text-on-surface">Variation #45 Due in 2 days</span>
                  </div>
                  <div className="bg-surface-deep px-4 py-2 rounded border border-status-error/30 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-status-error" />
                    <span className="text-xs text-on-surface">Insurance Expiring Soon</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ WHY SUBCONTRACTORS CHOOSE SUBBIE HQ ============ */}
        <section className="bg-surface-container py-section-gap-sm md:py-section-gap-lg px-gutter">
          <div className="max-w-container-max mx-auto">
            <SectionKicker>Why Subcontractors Choose Subbie HQ</SectionKicker>
            <div className="flex flex-col gap-section-gap-sm">
              <div className="flex flex-col md:flex-row items-center gap-12">
                <div className="w-full md:w-1/2 flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <span className="material-symbols-outlined text-accent-electric text-[24px] mt-1">construction</span>
                    <div>
                      <h4 className="font-bold text-on-surface mb-2">
                        Built for subcontractors, not the head contractor&apos;s paperwork.
                      </h4>
                      <p className="text-on-surface-variant">
                        Most software in this space exists to make main contractors&apos; lives easier, and subbies
                        get forced onto it. Subbie HQ exists because you chose it.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <div className="bg-surface-card rounded-xl border border-white/5 p-2 shadow-lg overflow-hidden">
                    <Image
                      src="/marketing/hero-site-supervisor.jpg"
                      alt="A construction site supervisor in a high-vis vest checking his phone on a building site"
                      width={1168}
                      height={784}
                      sizes="(min-width: 768px) 480px, 100vw"
                      className="w-full h-auto rounded object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row-reverse items-center gap-12">
                <div className="w-full md:w-1/2 flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <span className="material-symbols-outlined text-accent-electric text-[24px] mt-1">payments</span>
                    <div>
                      <h4 className="font-bold text-on-surface mb-2">Priced for a sole trader, not a head office.</h4>
                      <p className="text-on-surface-variant">
                        Plans start at $49/month, unlimited users, unlimited projects. You&apos;re never charged more
                        for being busy — and as your team grows, each person gets exactly the access their role
                        needs.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <div className="bg-surface-card rounded-xl border border-white/5 p-2 shadow-lg overflow-hidden">
                    <Image
                      src="/marketing/pricing-tablet.webp"
                      alt="A hand holding a tablet showing a subscription plan with pricing and features"
                      width={1024}
                      height={1024}
                      sizes="(min-width: 768px) 480px, 100vw"
                      className="w-full h-auto rounded object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-12">
                <div className="w-full md:w-1/2 flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <span className="material-symbols-outlined text-accent-electric text-[24px] mt-1">public</span>
                    <div>
                      <h4 className="font-bold text-on-surface mb-2">Built for NZ and Australian contracts.</h4>
                      <p className="text-on-surface-variant">
                        Compared against SA-2017 and the obligations you actually operate under — not a generic
                        platform retrofitted for this market.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <div className="bg-surface-card rounded-xl border border-white/5 p-2 shadow-lg overflow-hidden">
                    <Image
                      src="/marketing/nz-contract-review-tablet.webp"
                      alt="A hand holding a tablet showing a Subbie HQ plain-English breakdown of a subcontract clause"
                      width={1024}
                      height={1024}
                      sizes="(min-width: 768px) 480px, 100vw"
                      className="w-full h-auto rounded object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row-reverse items-center gap-12">
                <div className="w-full md:w-1/2 flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <span className="material-symbols-outlined text-accent-electric text-[24px] mt-1">dashboard</span>
                    <div>
                      <h4 className="font-bold text-on-surface mb-2">Everything, across every job, in one place.</h4>
                      <p className="text-on-surface-variant">
                        Running more than one project? A single Dashboard shows what needs your attention across
                        all of them — no logging into each job separately to check.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <div className="bg-surface-card rounded-xl border border-white/5 p-2 shadow-lg overflow-hidden">
                    <Image
                      src="/marketing/dashboard-multi-project.jpg"
                      alt="A laptop screen showing a project dashboard with several active projects and their status"
                      width={1168}
                      height={784}
                      sizes="(min-width: 768px) 480px, 100vw"
                      className="w-full h-auto rounded object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section className="max-w-3xl mx-auto px-4 py-section-gap-sm">
          <h2 className="font-heading text-2xl font-bold text-on-surface mb-4">How It Works</h2>
          <p className="text-on-surface-variant">
            Behind the scenes, Subbie HQ reads your documents and compares them against standard construction terms
            automatically. You don&apos;t need to understand the technology to benefit from it — but it&apos;s worth
            knowing: every automated finding is a starting point for your own judgement, not a legal opinion. For
            anything genuinely high-stakes, we&apos;ll always tell you to get real legal advice.
          </p>
        </section>

        {/*
          Social proof placeholder — hidden until a real pilot quote exists.
          Drop the quote/name/trade/region in below and remove this comment
          to bring the section back; keep the same on-surface/on-surface-variant
          classes so it matches the rest of the page without a rebuild.

          <section className="max-w-3xl mx-auto px-4 py-14 text-center">
            <p className="italic text-on-surface-variant">
              &ldquo;[Pilot user quote — e.g. catching a risky clause, or getting a variation paid faster.]&rdquo;
            </p>
            <p className="text-sm font-bold text-on-surface mt-2">— [Name], [Trade], [Region]</p>
          </section>
        */}

        {/* ============ FINAL CTA ============ */}
        <section className="bg-gradient-to-b from-surface-container to-surface-deep py-section-gap-sm px-gutter border-t border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-electric/10 via-surface-deep/50 to-surface-deep pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center gap-8">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
              Everything you need to keep the job organised and the money flowing — from the first page of the
              contract to the last dollar claimed.
            </h2>
            {/* Sole CTA — "Book a Demo" was removed: it linked to /signup
                identically to this button, and there's no real
                demo-booking flow to point it at instead. Re-add once one
                exists (e.g. a Calendly link or contact email). */}
            <Link
              href="/signup"
              className="h-11 px-8 flex items-center justify-center rounded-lg bg-accent-electric text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all active:scale-95"
            >
              Start Free Trial
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
