"use client";

import { useId, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";

const QUESTIONS = [
  {
    q: "Can I scan someone else?",
    a: "Not by email or phone number: Tacet verifies those before scanning them, with a one-time code for email and a tap in our Telegram bot that shares your account's number for phones. Usernames can't be verified, because there's no way to prove a name is yours: the same username can belong to different people on different sites. So Tacet scans usernames as you enter them, and our terms only allow scanning your own. Tacet is built to protect you, not to look people up.",
  },
  {
    q: "Where do the results come from?",
    a: "Five places: breach indexes, open leak indexes and infostealer logs, the open web (public pages, paste sites and forums, GitHub commits, PGP key servers and caller-ID sites; the deep scan adds 8 search engines searched in a real browser), popular services your email has an account on, public profiles on 7,000+ sites where usernames can be registered, and web archives that keep old copies of those profiles. Before a profile makes it into your report, Tacet checks the same site with a made-up username, so sites that answer yes to anything can't create false matches.",
  },
  {
    q: "Do you store the leaked data you find?",
    a: "No. Tacet records that your details appeared in a breach and which fields were exposed. It never downloads, stores or shows you the leaked records themselves.",
  },
  {
    q: "Can Tacet remove my data from the internet?",
    a: "Tacet tells you exactly what to remove and how, one exposure at a time. For sites covered by GDPR or CCPA, every report includes a removal request written for you, ready to send from your own email. Tacet doesn't contact sites for you.",
  },
  {
    q: "Does it work for phone numbers?",
    a: "Yes. Open leak indexes are searched by phone number too, and the open web search looks for it on public pages and listings. Your report says which source each result came from.",
  },
  {
    q: "How do I delete my account?",
    a: "From settings, in one step. Your account, scans and reports are permanently deleted within minutes.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <LazyMotion features={domAnimation} strict>
      <ul className="border-t border-mist">
        {QUESTIONS.map((item, i) => {
          const isOpen = open === i;
          const panel = `${base}-${i}`;
          return (
            <li key={item.q} className="border-b border-mist">
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-[17px] font-medium sm:text-[19px]"
                >
                  {item.q}
                  <span aria-hidden="true" className="relative h-3 w-3 shrink-0">
                    <span className="absolute left-0 top-1/2 h-px w-3 bg-ink" />
                    <span
                      className={`absolute left-0 top-1/2 h-px w-3 bg-ink transition-transform duration-300 ease-out-quint ${isOpen ? "" : "rotate-90"}`}
                    />
                  </span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <m.div
                    id={panel}
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="max-w-[62ch] pb-7 text-[16px] leading-[1.65] text-steel">{item.a}</p>
                  </m.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </LazyMotion>
  );
}
