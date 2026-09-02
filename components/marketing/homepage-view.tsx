import Image from "next/image";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export function HomepageView() {
  // No min-h-screen/flex-1 stretch — same fix as app/(marketing)/layout.tsx,
  // kept consistent here since this page renders its own header/footer
  // outside that route group.
  return (
    <div className="flex flex-col">
      <MarketingHeader />
      <main>
        <section className="max-w-4xl mx-auto px-4 py-20 text-center flex flex-col items-center gap-6">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            The Work Gets Done. The Money Doesn&apos;t Always Follow.
          </h1>
          <p className="text-lg text-[#4c739a] dark:text-slate-400 max-w-2xl">
            Every unproven Site Instruction, every unsigned dayworks sheet, every variation submitted without the
            right evidence is money quietly left on the table. Subbie HQ captures the proof as the job happens, so
            what you&apos;re owed is what you actually get paid — not what you&apos;re still arguing for three
            months later.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="h-11 px-6 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
            >
              Start Free Trial
            </Link>
            <Link
              href="#how-subbie-hq-helps"
              className="h-11 px-6 flex items-center justify-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              See How It Works
            </Link>
          </div>
          <p className="text-sm font-bold text-[#0d141b] dark:text-slate-50">
            Site Managers approve via a secure link — no app, no login required.
          </p>
          <p className="text-sm italic text-[#4c739a] dark:text-slate-400">
            Built specifically for subcontractors — not a main contractor&apos;s compliance tool you got forced
            onto.
          </p>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden border border-[#e7edf3] dark:border-slate-800 mt-2">
            <Image
              src="/marketing/hero-site-supervisor.jpg"
              alt="A construction site supervisor in a high-vis vest checking his phone on a building site"
              width={1168}
              height={784}
              priority
              sizes="(min-width: 640px) 672px, 100vw"
              className="w-full h-auto"
            />
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-bold mb-4">The Problem</h2>
          <p className="text-base font-bold mb-3">
            Most subcontractors sign contracts they don&apos;t have time to read properly — and do the paperwork
            evenings and weekends, if at all.
          </p>
          <p className="text-[#4c739a] dark:text-slate-400">
            Large contractors employ Contracts Managers to catch the clause that costs you money, chase the
            evidence a claim needs, and keep a job organised enough to survive a dispute. Most subcontractors
            can&apos;t justify that cost. So the paperwork gets rushed, evidence goes missing, and money gets left
            on the table — not because the work wasn&apos;t done, but because it wasn&apos;t proven.
          </p>
        </section>

        <section className="bg-[#f6f7f8] dark:bg-slate-900/40 py-14">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8 text-center">Your Job, From Start to Finish</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark p-6">
                <div className="rounded-lg overflow-hidden mb-4 border border-[#e7edf3] dark:border-slate-800">
                  <Image
                    src="/marketing/contract-documents-desk.jpg"
                    alt="Contract documents and a tablet laid out on a desk"
                    width={1168}
                    height={784}
                    sizes="(min-width: 768px) 480px, 100vw"
                    className="w-full h-auto"
                  />
                </div>
                <h3 className="font-bold mb-2">Before You Sign</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Understand what your contract actually expects of you. Identify the commercial risks before
                  you&apos;re committed to them. Know your scope of works and the programme milestones you&apos;re
                  held to — pulled straight from your own documents.
                </p>
              </div>
              <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark p-6">
                <div className="rounded-lg overflow-hidden mb-4 border border-[#e7edf3] dark:border-slate-800">
                  <Image
                    src="/marketing/site-instruction-leading-hand.jpg"
                    alt="A leading hand on site in high-vis, checking a clipboard and phone"
                    width={1168}
                    height={784}
                    sizes="(min-width: 768px) 480px, 100vw"
                    className="w-full h-auto"
                  />
                </div>
                <h3 className="font-bold mb-2">While You&apos;re On Site</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Capture Site Instructions the moment they&apos;re given. Record Updates. Take photos. Upload
                  Dayworks Sheets. Everything organised against the job, from your phone, without a spreadsheet
                  in sight.
                </p>
              </div>
              <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark p-6">
                <div className="rounded-lg overflow-hidden mb-4 border border-[#e7edf3] dark:border-slate-800">
                  <Image
                    src="/marketing/variation-claim-package.jpg"
                    alt="A Site Instruction, Dayworks Sheet, photos, and a tablet showing a Variation Claim Package laid out together"
                    width={1168}
                    height={784}
                    sizes="(min-width: 768px) 480px, 100vw"
                    className="w-full h-auto"
                  />
                </div>
                <h3 className="font-bold mb-2">When It&apos;s Time to Claim</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Build a complete Variation package — instruction, dayworks, materials, photos, correspondence —
                  then send it for approval with a secure link. No app, no login required: the Main Contractor
                  opens it and acts, and you track the response. It&apos;s the evidence base you need to prepare a
                  payment claim with confidence, without digging for anything after the fact.
                </p>
              </div>
              <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-background-dark p-6">
                <h3 className="font-bold mb-2">When a Dispute Happens</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Every email. Every photo. Every Site Instruction. Every Dayworks Sheet. Every Update. Already
                  organised, already dated, already there.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-subbie-hq-helps" className="max-w-5xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-bold mb-8 text-center">How Subbie HQ Helps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold mb-2">Understand Your Contract Before You Sign</h3>
              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                Upload your subcontract and get a plain-English breakdown of what&apos;s different from standard
                terms, what it means for your business, and what to do about it.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Never Lose Track of a Site Instruction Again</h3>
              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                Forward the email the moment it lands. Log a verbal instruction on site. Either way, it&apos;s
                recorded, timestamped, and ready to turn into a claim.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Never Lose Labour Costs Again</h3>
              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                Photograph the dayworks sheet. Confirm the crew, hours, and rate. No re-typing timesheets from
                memory at the end of the week.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Build Professional Variation Claims in Minutes</h3>
              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                One button bundles the instruction, the evidence, and the costing into a document ready to send.
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-24 sm:w-28 shrink-0 rounded-lg overflow-hidden border border-[#e7edf3] dark:border-slate-800">
                <Image
                  src="/marketing/secure-approval-phone.jpg"
                  alt="A phone screen showing a secure approval request that requires no login"
                  width={784}
                  height={1168}
                  sizes="112px"
                  className="w-full h-auto"
                />
              </div>
              <div>
                <h3 className="font-bold mb-2">Get Sign-Off Without Chasing a Signature</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Site Managers and Main Contractors approve via a secure link — no app, no login required. Track
                  every request from sent to responded, or let the whole monthly cycle send itself.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-bold mb-2">Nothing Quietly Goes Overdue</h3>
              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                Variation and Site Instruction deadlines, H&amp;S document expiry, insurance renewal — staged email
                and push alerts before anything lapses, not after.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#f6f7f8] dark:bg-slate-900/40 py-14">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8 text-center">Why Subcontractors Choose Subbie HQ</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-bold mb-2">Built for subcontractors, not the head contractor&apos;s paperwork.</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Most software in this space exists to make main contractors&apos; lives easier, and subbies get
                  forced onto it. Subbie HQ exists because you chose it.
                </p>
              </div>
              <div>
                <h3 className="font-bold mb-2">Priced for a sole trader, not a head office.</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Plans start at $49/month, unlimited users, unlimited projects. You&apos;re never charged more for
                  being busy — and as your team grows, each person gets exactly the access their role needs.
                </p>
              </div>
              <div>
                <h3 className="font-bold mb-2">Built for NZ and Australian contracts.</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Compared against SA-2017 and the obligations you actually operate under — not a generic platform
                  retrofitted for this market.
                </p>
              </div>
              <div>
                <div className="rounded-lg overflow-hidden mb-4 border border-[#e7edf3] dark:border-slate-800">
                  <Image
                    src="/marketing/dashboard-multi-project.jpg"
                    alt="A laptop screen showing a project dashboard with several active projects and their status"
                    width={1168}
                    height={784}
                    sizes="(min-width: 768px) 340px, 100vw"
                    className="w-full h-auto"
                  />
                </div>
                <h3 className="font-bold mb-2">Everything, across every job, in one place.</h3>
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Running more than one project? A single Dashboard shows what needs your attention across all of
                  them — no logging into each job separately to check.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <p className="text-[#4c739a] dark:text-slate-400">
            Behind the scenes, Subbie HQ reads your documents and compares them against standard construction
            terms automatically. You don&apos;t need to understand the technology to benefit from it — but
            it&apos;s worth knowing: every automated finding is a starting point for your own judgement, not a
            legal opinion. For anything genuinely high-stakes, we&apos;ll always tell you to get real legal
            advice.
          </p>
        </section>

        {/*
          Social proof placeholder — hidden until a real pilot quote exists.
          Drop the quote/name/trade/region in below and remove this comment
          to bring the section back; keep the same markup/classes so it
          matches the rest of the page without a rebuild.

          <section className="max-w-3xl mx-auto px-4 py-14 text-center">
            <p className="italic text-[#4c739a] dark:text-slate-400">
              &ldquo;[Pilot user quote — e.g. catching a risky clause, or getting a variation paid faster.]&rdquo;
            </p>
            <p className="text-sm font-bold mt-2">— [Name], [Trade], [Region]</p>
          </section>
        */}

        <section className="bg-primary/5 dark:bg-primary/10 py-16">
          <div className="max-w-2xl mx-auto px-4 text-center flex flex-col items-center gap-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Everything you need to keep the job organised and the money flowing — from the first page of the
              contract to the last dollar claimed.
            </h2>
            {/* Sole CTA — "Book a Demo" was removed: it linked to /signup
                identically to this button, and there's no real
                demo-booking flow to point it at instead. Re-add once one
                exists (e.g. a Calendly link or contact email). */}
            <Link
              href="/signup"
              className="h-11 px-6 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
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
