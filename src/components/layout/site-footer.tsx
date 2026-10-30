import Link from "next/link";
import Logo from "./logo";
import { LEGAL } from "@/lib/legal";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/security", label: "Security" },
  { href: `mailto:${LEGAL.email.hello}`, label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="on-dark border-t border-white/10 bg-black text-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <p className="text-[13px] text-white/45">&copy; 2026 Tacet</p>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[14px] text-white/55">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition-colors duration-200 hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
