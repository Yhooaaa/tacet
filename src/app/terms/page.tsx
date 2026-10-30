import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/legal-page";
import { EARLY_ACCESS_DISCOUNT, EARLY_PRICE_LABEL, PRO_PRICE_LABEL } from "@/lib/pricing";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Tacet: what the service does, what you may use it for, plans, and our responsibilities.",
};

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          These terms are an agreement between you and{" "}
          {LEGAL.entity ? `${LEGAL.entity}${LEGAL.address ? `, ${LEGAL.address}` : ""}` : `the founder who runs ${LEGAL.product}`} (&ldquo;{LEGAL.product}&rdquo;,
          &ldquo;we&rdquo;). By
          running a scan or creating an account you accept them. If you use {LEGAL.product} for an organisation, you confirm you&apos;re allowed
          to accept them on its behalf.
        </p>
        <p>
          How we handle personal data is covered by our <Link href="/privacy">Privacy Policy</Link>, which forms part of these terms.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use Tacet",
    body: (
      <p>
        You must be at least {LEGAL.minimumAge} years old, or the age of digital consent where you live if that&apos;s higher, and able to form a
        binding contract.
      </p>
    ),
  },
  {
    id: "service",
    title: "What Tacet does",
    body: (
      <>
        <p>
          {LEGAL.product} checks breach indexes, the open web, web archives and public profiles for the emails and phone numbers you&apos;ve verified and the usernames you enter, ranks
          what it finds by risk, and explains how to remove each result. With a free account you can also track your opt-outs from data
          brokers. Pro, once it opens, adds a deep scan with a browser agent and AI analysis, and breach monitoring with alerts.
        </p>
        <p>
          Results come from third-party sources we don&apos;t control. A scan can miss things, and it can surface an account that shares your
          username but belongs to someone else. Reports are information to help you, not legal, financial or security advice.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>
          {LEGAL.product} is for protecting <strong>yourself</strong>. You agree to scan only details that belong to you, and not to:
        </p>
        <ul>
          <li>verify, or try to verify, someone else&apos;s email or phone number;</li>
          <li>scan a username that isn&apos;t yours. Usernames can&apos;t be verified, so we rely on you to enter only your own;</li>
          <li>use {LEGAL.product} to find, profile, track, harass or stalk anyone;</li>
          <li>resell results, or use them for background checks, employment, credit, insurance or housing decisions;</li>
          <li>get around verification, rate limits or other safeguards, or access the service with bots or scripts we haven&apos;t approved;</li>
          <li>probe or attack our systems, except as allowed by our <Link href="/security">security research policy</Link>;</li>
          <li>break any law, or the terms of the sites our scans check.</li>
        </ul>
        <p>We may suspend or close accounts that break these rules, without notice where the misuse puts others at risk.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <p>
        You sign in with one-time codes sent to your email, so keep that inbox secure. You&apos;re responsible for what happens in your account.
        Tell us at {mail(LEGAL.email.security)} if you think someone else has access. You can delete your account at any time from your dashboard.
      </p>
    ),
  },
  {
    id: "plans",
    title: "Plans and payment",
    body: (
      <>
        <p>
          The Free plan includes one full scan per person, of up to 1 email, 1 phone number and 3 usernames. We count it against your IP address
          (for 30 days), the details you scan and your account, and we don&apos;t accept disposable email addresses. Creating extra accounts,
          switching networks or using other people&apos;s details to get more free scans breaks these terms.
        </p>
        <p>
          <strong>Pro isn&apos;t on sale yet.</strong> You can reserve it on our <Link href="/#pricing">pricing</Link> section or after a scan.
          A reservation is free and binds neither of us: we take no payment details and charge nothing. We plan to price Pro at{" "}
          {PRO_PRICE_LABEL} a month, and everyone who reserves before launch will be offered {EARLY_ACCESS_DISCOUNT}% off, so{" "}
          {EARLY_PRICE_LABEL} a month. When Pro opens we&apos;ll email you, and you decide then whether to subscribe.
        </p>
        <p>
          Before we take any payment, we&apos;ll add the payment terms to this page (billing, renewal, cancellation and refunds, including the
          14-day right of withdrawal for customers in the EU and UK) and email everyone who reserved.
        </p>
        {LEGAL.paymentProcessor && (
          <p>
            Payments are processed by {LEGAL.paymentProcessor.name}. We never see or store your full card number.
          </p>
        )}
      </>
    ),
  },
  {
    id: "removal-requests",
    title: "Removal requests",
    body: (
      <p>
        {LEGAL.product} drafts GDPR and CCPA removal requests and guides you through broker opt-outs, but you send them, from your own email and
        in your name. Each site decides how and when to respond, and some list people again later. We can&apos;t guarantee any site will remove
        your data, and we don&apos;t contact sites on your behalf.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Our content and yours",
    body: (
      <p>
        {LEGAL.product}, its software, design and reports are ours or our licensors&apos;. We give you a personal, non-transferable licence to use
        them while you use the service. Your details and reports remain yours. Some site definitions come from the WhatsMyName project, used
        under the CC BY-SA 4.0 licence, and from the Maigret project, used under the MIT licence.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Changes and availability",
    body: (
      <p>
        We improve {LEGAL.product} all the time, which means features and sources can change. We aim to keep the service running but don&apos;t
        promise it will be uninterrupted. If we ever shut down a paid service, we&apos;ll give at least 30 days&apos; notice and refund any unused
        prepaid time.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <>
        <p>
          {LEGAL.product} is provided &ldquo;as is&rdquo;. To the extent the law allows, we disclaim implied warranties, including fitness for a
          particular purpose, and we aren&apos;t liable for indirect or consequential losses, or for what third-party sites do with your data.
        </p>
        <p>
          Our total liability under these terms is limited to the greater of the amount you paid us in the 12 months before the claim and 100 US
          dollars. Nothing in these terms limits liability that can&apos;t be limited by law, such as for fraud, gross negligence, or death or
          personal injury caused by negligence, or your statutory rights as a consumer.
        </p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending the agreement",
    body: (
      <p>
        You can stop using {LEGAL.product} and delete your account at any time. We may end these terms or suspend access if you seriously or
        repeatedly break them. Sections that by their nature should survive, such as liability and governing law, continue after the agreement
        ends.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <p>
        {LEGAL.governingLaw
          ? `These terms are governed by the laws of ${LEGAL.governingLaw}, and its courts have jurisdiction. If you're a consumer, you also keep the protection of the mandatory laws of the country where you live and can bring a claim there.`
          : "As a consumer, you keep the protection of the mandatory laws of the country where you live and can bring a claim there."}{" "}
        Please contact us first; most problems can be fixed with an email.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We&apos;ll email account holders at least 14 days before a material change takes effect. If you don&apos;t agree, you can delete your
        account before then; continuing to use {LEGAL.product} after that means you accept the new terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {LEGAL.entity && `${LEGAL.entity}${LEGAL.address ? `, ${LEGAL.address}` : ""}. `}{LEGAL.email.legal === LEGAL.email.hello ? (
          <>Email {mail(LEGAL.email.legal)} for legal notices and anything else.</>
        ) : (
          <>
            Email {mail(LEGAL.email.legal)} for legal notices and {mail(LEGAL.email.hello)} for everything else.
          </>
        )}
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of Service"
      intro={<p>The rules for using {LEGAL.product}, written to be read, not skimmed past.</p>}
      glance={[
        "Scan only details that belong to you. Looking up other people is not allowed.",
        "Results come from third-party sources and can be incomplete. They aren't legal advice.",
        "Pro isn't on sale yet. Reserving it is free and commits you to nothing.",
        "We draft removal requests, but each site decides whether to remove your data.",
        "You can delete your account at any time.",
      ]}
      sections={sections}
    />
  );
}
