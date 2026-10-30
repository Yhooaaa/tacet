"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, m, LazyMotion, domAnimation } from "motion/react";
import Logo from "./logo";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#what-we-check", label: "What we check" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <LazyMotion features={domAnimation} strict>
      <header
        className={`on-dark fixed inset-x-0 top-0 z-50 text-white transition-[background-color,border-color] duration-300 ${
          scrolled || open ? "border-b border-white/10 bg-black/80 backdrop-blur-xl" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-8">
          <Link href="/" aria-label="Tacet home" className="rounded-sm">
            <Logo />
          </Link>

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-8 text-[14px] text-white/65">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors duration-200 hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-5 md:flex">
            <Link href="/signin" className="text-[14px] text-white/65 transition-colors duration-200 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/scan"
              className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[14px] font-medium text-black transition-colors duration-200 hover:bg-white/85"
            >
              Start free scan
            </Link>
          </div>

          <button
            type="button"
            className="relative -mr-2 flex h-10 w-10 items-center justify-center md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className={`absolute h-px w-5 bg-white transition-transform duration-300 ease-out-quint ${open ? "rotate-45" : "-translate-y-[4px]"}`}
            />
            <span
              className={`absolute h-px w-5 bg-white transition-transform duration-300 ease-out-quint ${open ? "-rotate-45" : "translate-y-[4px]"}`}
            />
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <m.nav
              id="mobile-menu"
              aria-label="Mobile"
              className="overflow-hidden md:hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <ul className="px-5 pb-6 pt-2">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block border-b border-white/10 py-4 text-[17px] text-white/80"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/signin"
                    onClick={() => setOpen(false)}
                    className="block border-b border-white/10 py-4 text-[17px] text-white/80"
                  >
                    Sign in
                  </Link>
                </li>
                <li className="pt-6">
                  <Link
                    href="/scan"
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center justify-center rounded-full bg-white text-[15px] font-medium text-black"
                  >
                    Start free scan
                  </Link>
                </li>
              </ul>
            </m.nav>
          )}
        </AnimatePresence>
      </header>
    </LazyMotion>
  );
}
