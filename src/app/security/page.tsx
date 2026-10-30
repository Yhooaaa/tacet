import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Security",
  description: "How Tacet protects your data, and how to report a vulnerability.",
};

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

const sections: LegalSection[] = [
  {
    id: "principles",
    title: "Our approach",
    body: (
      <>
        <p>
          The safest data is data we never hold. {LEGAL.product} is designed to keep as little as possible, for as short a time as possible:
        </p>
        <ul>
          <li>Scan reports are streamed to your browser and not stored on our servers.</li>
          <li>We never download or store leaked records. We only note that your details appeared in a breach and which kinds of data were exposed.</li>
          <li>Accounts have no passwords, so there&apos;s no password database to leak.</li>
          <li>Deleting your account erases it and everything linked to it straight away.</li>
        </ul>
      </>
    ),
  },
  {
    id: "verification",
    title: "Verification",
    body: (
      <>
        <p>
          Every email address and phone number has to be verified before it&apos;s scanned. Usernames aren&apos;t verified: there&apos;s no way to
          prove a username is yours, since the same name can belong to different people on different sites, so they&apos;re scanned as you enter
          them. For emails and phone numbers:
        </p>
        <ul>
          <li>Codes are random, expire after 10 minutes and are stored only as a keyed hash, never in plain text.</li>
          <li>Each code allows five attempts and works only once, and codes are compared in constant time.</li>
          <li>Wrong codes are also capped per email or phone number per day, so requesting new codes doesn&apos;t improve the odds of guessing.</li>
          <li>We limit how many codes can be sent to the same address or number, so {LEGAL.product} can&apos;t be used to flood someone&apos;s inbox.</li>
          <li>
            Phone numbers are confirmed by Telegram: our bot only accepts the number of the Telegram account that shares it, never a forwarded
            contact, and only through the one-time link opened from your verification.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "application",
    title: "Application security",
    body: (
      <ul>
        <li>
          Sessions and verification proofs are tokens signed with HMAC-SHA256 and a server-side secret, so they can&apos;t be forged or altered.
        </li>
        <li>
          The session cookie is <code>HttpOnly</code>, <code>Secure</code> and <code>SameSite=Lax</code>: scripts can&apos;t read it, it&apos;s
          only sent over HTTPS and it isn&apos;t sent with requests from other sites.
        </li>
        <li>Sign-in, verification and scans are rate-limited per IP address and per target.</li>
        <li>Messages to our Telegram bot are only accepted with a secret that Telegram sends with each one.</li>
        <li>
          Requests that change anything must come from {LEGAL.site} itself, which blocks cross-site request forgery. Request bodies are size-limited
          and validated before use.
        </li>
        <li>Every database query is parameterised, so nothing you type is ever run as SQL.</li>
        <li>
          Pages send a Content Security Policy and related headers: scripts, styles and fonts only from our own domain, no framing by other
          sites, HTTPS only, and no access to your camera, microphone or location.
        </li>
        <li>
          The scanner only connects to public internet addresses and re-checks every redirect, so a hostile site can&apos;t point it at our own
          systems. Links from scan results are limited to ordinary web addresses before they reach your browser.
        </li>
        <li>
          When AI writes your report&apos;s analysis, emails and phone numbers are masked before anything is sent to the model provider.
        </li>
        <li>Secrets and API keys live in the server environment only and are never sent to the browser.</li>
      </ul>
    ),
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    body: (
      <>
        <p>
          {LEGAL.product} runs on {LEGAL.hosting.name ?? "servers"} in the {LEGAL.hosting.location}. All traffic is encrypted in transit with TLS, and
          browsers are told to use HTTPS only (HSTS). Access to production systems is limited to the people who run the service, and protected
          with two-factor authentication.
        </p>
        <p>
          The providers we rely on are listed, with what each receives, in our <Link href="/privacy#sharing">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "incidents",
    title: "If something goes wrong",
    body: (
      <p>
        If we discover a breach affecting your personal data, we&apos;ll notify the relevant data protection authority within 72 hours where the
        GDPR requires it, and tell affected users without undue delay what happened, what data was involved and what we&apos;re doing about it.
      </p>
    ),
  },
  {
    id: "report",
    title: "Reporting a vulnerability",
    body: (
      <>
        <p>
          If you think you&apos;ve found a security issue, email {mail(LEGAL.email.security)} with the steps to reproduce it and its impact. We&apos;ll
          acknowledge your report within {LEGAL.securityTriageDays} business days, keep you updated while we fix it, and credit you when it&apos;s
          resolved if you&apos;d like. Our contact details are also published in{" "}
          <a href="/.well-known/security.txt">
            <code>/.well-known/security.txt</code>
          </a>
          .
        </p>
        <h3>In scope</h3>
        <ul>
          <li>{LEGAL.site} and its subdomains, including the API</li>
          <li>Bypassing email or phone verification, or reading someone else&apos;s account or alerts</li>
          <li>Authentication, session and authorization flaws, injection, and cross-site scripting</li>
        </ul>
        <h3>Out of scope</h3>
        <ul>
          <li>Denial-of-service and load testing, spam, and social engineering of our team or providers</li>
          <li>Findings in third-party sites that {LEGAL.product} scans</li>
          <li>Missing headers or best-practice notes without a demonstrated impact</li>
        </ul>
        <h3>Safe harbor</h3>
        <p>
          We won&apos;t take legal action against research done in good faith under this policy. That means using only test accounts and details you
          own, not accessing or keeping other people&apos;s data, stopping and reporting as soon as you find an issue, and giving us reasonable time
          to fix it before you disclose it publicly.
        </p>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <LegalPage
      current="/security"
      title="Security"
      intro={<p>You trust us with the details that make you findable. Here&apos;s how we protect them, and how to tell us if we got something wrong.</p>}
      glance={[
        "Emails and phone numbers are verified before they're scanned, so nobody can look you up by them.",
        "No passwords, no stored reports and no leaked records on our servers.",
        "Signed, tamper-proof sessions in a cookie scripts can't read.",
        `Found a vulnerability? Email ${LEGAL.email.security}.`,
      ]}
      sections={sections}
    />
  );
}
