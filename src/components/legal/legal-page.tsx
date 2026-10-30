import Link from "next/link";
import type { ReactNode } from "react";
import SiteFooter from "@/components/layout/site-footer";
import SiteHeader from "@/components/layout/site-header";
import { LEGAL } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: ReactNode };

const DOCS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/security", label: "Security" },
] as const;

type Props = {
  current: (typeof DOCS)[number]["href"];
  title: string;
  intro: ReactNode;
  glance: string[];
  sections: LegalSection[];
};

export default function LegalPage({ current, title, intro, glance, sections }: Props) {
  return (
    <>
      <SiteHeader />
      <main>
        <header className="on-dark bg-black text-white">
          <div className="mx-auto max-w-[1200px] px-5 pb-0 pt-32 md:px-8 md:pt-40">
            <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/45">Legal · Updated {LEGAL.updated}</p>
            <h1 className="font-display mt-5 text-[44px] font-medium leading-[1] sm:text-[64px] lg:text-[80px]">{title}</h1>
            <div className="mt-6 max-w-[60ch] text-[17px] leading-[1.6] text-white/65">{intro}</div>
            <nav aria-label="Legal documents" className="mt-14 -mb-px overflow-x-auto">
              <ul className="flex gap-8 text-[14px]">
                {DOCS.map((doc) => {
                  const active = doc.href === current;
                  return (
                    <li key={doc.href}>
                      <Link
                        href={doc.href}
                        aria-current={active ? "page" : undefined}
                        className={`block border-b-2 pb-4 transition-colors duration-200 ${
                          active ? "border-white text-white" : "border-transparent text-white/50 hover:text-white"
                        }`}
                      >
                        {doc.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 md:grid-cols-[220px_minmax(0,1fr)] md:gap-16 md:px-8 md:py-24">
          <aside className="hidden md:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">On this page</p>
              <ol className="mt-4 space-y-2.5 text-[14px] text-steel">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex gap-3 transition-colors duration-200 hover:text-ink">
                      <span className="font-mono text-[12px] text-slate">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0 max-w-[72ch]">
            <section aria-labelledby="glance" className="rounded-2xl bg-smoke p-6 sm:p-8">
              <h2 id="glance" className="font-mono text-[12px] uppercase tracking-[0.14em] text-steel">
                The short version
              </h2>
              <ul className="mt-5 space-y-3">
                {glance.map((line) => (
                  <li key={line} className="flex gap-3 text-[16px] leading-[1.6]">
                    <span aria-hidden="true" className="mt-[11px] h-[5px] w-[5px] shrink-0 rounded-full bg-ink" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 border-b border-mist py-12 last:border-b-0">
                <h2 id={`${s.id}-title`} className="flex items-baseline gap-4 text-[24px] font-medium leading-[1.25] sm:text-[28px]">
                  <span className="font-mono text-[13px] font-normal text-slate">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="legal-prose mt-5">{s.body}</div>
              </section>
            ))}

            <p className="mt-4 text-[14px] leading-[1.6] text-steel">
              Questions about this page? Write to{" "}
              <a href={`mailto:${LEGAL.email.legal}`} className="text-ink underline underline-offset-4">
                {LEGAL.email.legal}
              </a>
              .
            </p>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-mist">
      <table className="w-full min-w-[560px] border-collapse text-left text-[14px] leading-[1.5]">
        <thead className="bg-smoke">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-mist align-top">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "font-medium text-ink" : "text-steel"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
