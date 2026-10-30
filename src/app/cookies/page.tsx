import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalTable, type LegalSection } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Tacet uses one strictly necessary cookie and no analytics or advertising cookies.",
};

const sections: LegalSection[] = [
  {
    id: "what-we-use",
    title: "What we store in your browser",
    body: (
      <>
        <p>This is the complete list:</p>
        <LegalTable
          head={["Name", "Type", "Purpose", "Expires"]}
          rows={[
            [
              <code key="c">tacet_session</code>,
              "Cookie, first-party, strictly necessary",
              "Keeps you signed in. It holds a signed token with your account ID, can't be read by scripts on the page (HttpOnly), is only sent over HTTPS (Secure) and isn't sent with requests from other sites (SameSite=Lax).",
              "30 days, or when you sign out",
            ],
            [
              <code key="s">tacet:pending-proofs</code>,
              "Session storage, strictly necessary",
              "After a scan, if you choose to monitor your details but aren't signed in yet, it remembers the details you just verified while you sign in, so you don't have to verify them twice.",
              "Removed as soon as you're back from signing in, or when you close the tab",
            ],
          ]}
        />
        <p>
          The <code>tacet_session</code> cookie is only set when you sign in. If you only run a free scan, we set no cookies at all.
        </p>
      </>
    ),
  },
  {
    id: "what-we-dont",
    title: "What we don't use",
    body: (
      <>
        <ul>
          <li>No analytics cookies, tracking pixels or local storage. We count a few steps (such as the home page opening) as bare daily totals on our server; nothing is stored in your browser for it.</li>
          <li>No advertising, retargeting or social media cookies.</li>
          <li>No third-party scripts that set their own cookies. Our fonts are served from our own domain, so loading a page doesn&apos;t contact Google or any other font service.</li>
        </ul>
        <p>
          If that ever changes, we&apos;ll update this page first and ask for your consent before setting anything that isn&apos;t strictly
          necessary.
        </p>
      </>
    ),
  },
  {
    id: "consent",
    title: "Why there's no cookie banner",
    body: (
      <p>
        EU and UK law (the ePrivacy Directive and PECR) only require consent for cookies that aren&apos;t strictly necessary to provide a service you
        asked for. Everything above is needed to sign you in or finish a scan, so there&apos;s nothing to consent to and no banner to click through.
      </p>
    ),
  },
  {
    id: "control",
    title: "Controlling cookies",
    body: (
      <p>
        You can block or delete cookies in your browser settings. If you block <code>tacet_session</code>, scans still work, but you won&apos;t be
        able to stay signed in to your dashboard.
      </p>
    ),
  },
  {
    id: "more",
    title: "More information",
    body: (
      <p>
        How we handle personal data in general is explained in our <Link href="/privacy">Privacy Policy</Link>. Questions go to{" "}
        <a href={`mailto:${LEGAL.email.privacy}`}>{LEGAL.email.privacy}</a>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      current="/cookies"
      title="Cookie Policy"
      intro={<p>A short page, because there isn&apos;t much to tell.</p>}
      glance={[
        "One cookie, and only when you sign in: it keeps you signed in.",
        "No analytics, advertising or third-party cookies.",
        "Nothing optional is stored, so there's no consent banner.",
      ]}
      sections={sections}
    />
  );
}
