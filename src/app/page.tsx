import Link from "next/link";
import type { ReactNode } from "react";
import SiteHeader from "@/components/layout/site-header";
import Hero from "@/components/landing/hero";
import ExposureChain from "@/components/landing/exposure-chain";
import Faq from "@/components/landing/faq";
import SiteFooter from "@/components/layout/site-footer";
import { ReserveForm } from "@/components/landing/early-access";
import FunnelBeacon from "@/components/layout/funnel-beacon";
import { EARLY_ACCESS_DISCOUNT, EARLY_PRICE_LABEL, PRO_FEATURES, PRO_PRICE_LABEL } from "@/lib/pricing";

const SOURCES = [
  {
    name: "Data breaches",
    finds: "Your email, phone number and usernames in known breaches, leaks circulating openly and infostealer logs, and which fields leaked with them: passwords, addresses, dates of birth.",
    covers: "Email, phone, username",
  },
  {
    name: "The open web",
    finds: "Your phone number, email and username on public pages, paste sites and forums, your email in public GitHub commits and PGP key servers, and US and Canadian numbers on caller-ID sites. The deep scan adds a browser agent that searches 8 search engines the way a person would.",
    covers: "Email, phone, username",
  },
  {
    name: "Forgotten accounts",
    finds: "Which popular services your email has an account on, like Microsoft, Adobe, X, Snapchat and Spotify, with a link to delete each one you no longer use.",
    covers: "Email",
  },
  {
    name: "Username reuse",
    finds: "7,000+ sites where usernames can be registered: social networks, forums, games, apps and dating sites, and what each public profile reveals about you.",
    covers: "Usernames",
  },
  {
    name: "Web archives",
    finds: "Old copies of your profiles in the Wayback Machine and archive.today. They stay public even after you change or delete the account.",
    covers: "Usernames",
  },
];

const STEPS = [
  {
    title: "Add what's yours",
    body: "Confirm your email and phone with a one-time code, then add your usernames. There's no way to prove a username is yours, so those are scanned as you enter them.",
  },
  {
    title: "Tacet scans",
    body: "Tacet searches breaches, 7,000+ sites, the open web and web archives. The deep scan adds AI agents that search 8 search engines and connect what they find. Most scans finish in about a minute.",
  },
  {
    title: "You go quiet",
    body: "Get every exposure ranked by risk, with the link to delete it and a ready-to-send GDPR or CCPA erasure request.",
  },
];

const RULES = [
  {
    title: "Built for scanning yourself",
    body: "Emails and phone numbers are verified before they're scanned. Usernames can't be proven, so our terms only allow scanning your own.",
  },
  {
    title: "No leaked data, ever",
    body: "We record that your details appeared in a breach. We never download, store or display the leaked records.",
  },
  {
    title: "Delete everything in one step",
    body: "Your account, scans and reports are permanently deleted within minutes of your request.",
  },
  {
    title: "GDPR and CCPA by design",
    body: "Your data is processed in the EU, kept only as long as your report needs it, and never sold or shared.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    summary: "See where you stand today.",
    features: ["One scan", "Breaches, 7,000+ sites, the open web and web archives", "Exposure report ranked by risk", "Removal steps for every result"],
    cta: "Start free scan",
    href: "/scan",
    featured: false,
  },
  {
    name: "Pro",
    price: PRO_PRICE_LABEL,
    period: `a month · ${EARLY_PRICE_LABEL} if you reserve before launch`,
    summary: "Opening soon. Reserve it now, pay nothing until launch.",
    features: PRO_FEATURES,
    cta: "",
    href: "",
    featured: true,
  },
];

function SectionHeading({ id, title, children }: { id?: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-[640px]">
      <h2 id={id} className="font-display text-[34px] font-medium leading-[1.05] sm:text-[44px] lg:text-[52px]">
        {title}
      </h2>
      {children && <p className="mt-5 text-[17px] leading-[1.6] text-steel">{children}</p>}
    </div>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="mt-[3px] shrink-0">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <FunnelBeacon step="landing" />
      <main>
        <Hero />

        <section aria-labelledby="chain-title" className="mx-auto max-w-[1200px] px-5 py-28 md:px-8 md:py-36">
          <SectionHeading id="chain-title" title="One username is enough to find you.">
            Most exposures look harmless on their own. Together they form a chain that leads back to you. Tacet maps
            the chain and shows you which link to break.
          </SectionHeading>
          <div className="mt-16">
            <ExposureChain />
          </div>
        </section>

        <section id="what-we-check" aria-labelledby="check-title" className="border-t border-mist bg-smoke">
          <div className="mx-auto max-w-[1200px] px-5 py-28 md:px-8 md:py-36">
            <SectionHeading id="check-title" title="What Tacet checks." />
            <div className="mt-14 border-t border-ink/15">
              <div className="hidden grid-cols-[minmax(0,3fr)_minmax(0,6fr)_minmax(0,2fr)] gap-8 border-b border-ink/15 py-4 text-[13px] text-slate md:grid">
                <span>Source</span>
                <span>What it finds</span>
                <span>Works with</span>
              </div>
              {SOURCES.map((s) => (
                <div
                  key={s.name}
                  className="grid gap-2 border-b border-ink/15 py-8 md:grid-cols-[minmax(0,3fr)_minmax(0,6fr)_minmax(0,2fr)] md:gap-8"
                >
                  <h3 className="font-display text-[22px] font-medium leading-tight">{s.name}</h3>
                  <p className="max-w-[56ch] text-[16px] leading-[1.6] text-steel">{s.finds}</p>
                  <p className="text-[14px] text-ink md:pt-1">{s.covers}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-title" className="mx-auto max-w-[1200px] px-5 py-28 md:px-8 md:py-36">
          <SectionHeading id="how-title" title="Three steps to a quieter footprint." />
          <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t border-ink pt-6">
                <span className="text-[14px] tabular-nums text-slate">{i + 1}</span>
                <h3 className="font-display mt-6 text-[24px] font-medium leading-tight">{step.title}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-steel">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rules-title" className="on-dark bg-black text-white">
          <div className="mx-auto grid max-w-[1200px] gap-16 px-5 py-28 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:px-8 md:py-36">
            <div>
              <h2 id="rules-title" className="font-display text-[34px] font-medium leading-[1.05] sm:text-[44px] lg:text-[52px]">
                Built to protect you, not to find others.
              </h2>
              <p className="mt-5 max-w-[26rem] text-[17px] leading-[1.6] text-white/55">
                Tools that search for people already exist. Tacet is made for checking yourself.
              </p>
            </div>
            <dl className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
              {RULES.map((rule) => (
                <div key={rule.title} className="border-t border-white/20 pt-6">
                  <dt className="text-[18px] font-medium">{rule.title}</dt>
                  <dd className="mt-3 text-[15px] leading-[1.6] text-white/55">{rule.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-[1200px] px-5 py-28 md:px-8 md:py-36">
          <SectionHeading id="pricing-title" title="Start free. Go deeper when Pro opens.">
            Pro isn&rsquo;t on sale yet. Reserve it before launch and you&rsquo;ll get it at {EARLY_ACCESS_DISCOUNT}% off.
          </SectionHeading>
          <div className="mt-16 grid gap-5 md:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl p-8 md:p-10 ${plan.featured ? "on-dark bg-black text-white" : "border border-mist"}`}
              >
                <h3 className="text-[17px] font-medium">{plan.name}</h3>
                <p className={`mt-1 text-[15px] ${plan.featured ? "text-white/55" : "text-steel"}`}>{plan.summary}</p>
                <p className="mt-10 flex items-baseline gap-3">
                  <span className="font-display text-[56px] font-medium leading-none">{plan.price}</span>
                  {plan.period && <span className={`text-[14px] ${plan.featured ? "text-white/55" : "text-steel"}`}>{plan.period}</span>}
                </p>
                <ul className="mb-12 mt-10 space-y-3 text-[15px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.featured ? (
                  <div className="mt-auto">
                    <ReserveForm via="pricing" tone="dark" />
                  </div>
                ) : (
                  <Link
                    href={plan.href}
                    className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-black text-[15px] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-black/80 active:scale-[0.98]"
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="border-t border-mist">
          <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-28 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:px-8 md:py-36">
            <h2 id="faq-title" className="font-display text-[34px] font-medium leading-[1.05] sm:text-[44px]">
              Questions
            </h2>
            <Faq />
          </div>
        </section>

        <section aria-labelledby="cta-title" className="on-dark bg-black text-white">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-10 px-5 py-28 md:flex-row md:items-end md:justify-between md:px-8 md:py-32">
            <h2 id="cta-title" className="font-display max-w-[14ch] text-[40px] font-medium leading-[1.02] sm:text-[56px] lg:text-[68px]">
              Find out how loud you are.
            </h2>
            <Link
              href="/scan"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-white px-7 text-[15px] font-medium text-black transition-[background-color,transform] duration-200 hover:bg-white/85 active:scale-[0.98]"
            >
              Start free scan
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
