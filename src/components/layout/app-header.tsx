"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./logo";

const LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function AppHeader() {
  const path = usePathname();
  return (
    <header className="on-dark sticky top-0 z-50 border-b border-white/[0.06] bg-black/80 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="Tacet home" className="rounded-sm">
          <Logo />
        </Link>
        <nav aria-label="Product">
          <ul className="flex items-center gap-6 text-[13px]">
            {LINKS.map((l) => {
              const active = path === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`transition-colors ${active ? "text-white" : "text-white/55 hover:text-white"}`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
