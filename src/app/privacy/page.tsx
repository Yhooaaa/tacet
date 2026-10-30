import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalTable, type LegalSection } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Tacet collects, why, who it's shared with, how long it's kept and how to exercise your rights.",
};

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

const processors: [string, string, string, string][] = [
  [LEGAL.hosting.name ?? "Hosting provider", "Runs the app", "Everything in your account, while a request is handled", LEGAL.hosting.location],
  ["Neon", "Stores the account database", "Everything in your account", "European Union (Frankfurt)"],
  ["Brevo", "Sends verification codes and monitoring alerts by email", "Email address, message content", "France (EU)"],
  ["Telegram", "Runs the bot that confirms phone numbers", "The chat with our bot, including the phone number you share there", "United Arab Emirates"],
  ["Google (Gemini API)", "Writes the analysis section of Pro deep scan reports", "Usernames and scan findings; emails and phone numbers are masked first", "United States"],
  ["Anthropic (Claude API)", "Writes the analysis instead of Gemini when Gemini isn't set up", "Same as Gemini", "United States"],
  ...(LEGAL.paymentProcessor
    ? [[LEGAL.paymentProcessor.name, "Processes subscription payments", "Billing name, email, payment details", LEGAL.paymentProcessor.location] as [string, string, string, string]]
    : []),
];

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          {LEGAL.entity
            ? `${LEGAL.product} (${LEGAL.site}) is operated by ${LEGAL.entity}${LEGAL.address ? `, ${LEGAL.address}` : ""}${LEGAL.registration ? `, company number ${LEGAL.registration}` : ""}`
            : `${LEGAL.product} (${LEGAL.site}) is an independent project run by its founder`}{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;). We are the data controller for the personal data described in this policy.
        </p>
        <p>
          For anything privacy-related, write to {mail(LEGAL.email.privacy)}. We answer within {LEGAL.privacyResponseDays} days, and usually much
          sooner.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <h3>Details you ask us to scan</h3>
        <p>
          The email addresses, phone numbers and usernames you enter. We only scan an email or phone number after you prove it&apos;s yours: a
          one-time code for email; for a phone number, sharing it with our Telegram bot, which confirms the number belongs to your Telegram
          account. Usernames are scanned as you enter them: there&apos;s no way to prove a username is yours, since the same name can belong to
          different people on different sites.
        </p>
        <h3>Telegram</h3>
        <p>
          When you confirm a phone number in our Telegram bot, we receive the number on your Telegram account and your chat ID. We only compare
          the number with the one you entered: we store a keyed hash of it, never the number, together with the chat ID, for at most 10 minutes,
          and delete both once the check is done or expires. We don&apos;t message you in Telegram afterwards.
        </p>
        <h3>Verification codes</h3>
        <p>
          We never store codes in plain text. A code is kept only as a keyed hash inside a signed token that expires after 10 minutes, and a
          successful verification is valid for one hour.
        </p>
        <h3>Your account</h3>
        <p>If you create an account, we store:</p>
        <ul>
          <li>your sign-in email address and when the account was created;</li>
          <li>the details you&apos;ve verified and when you verified them;</li>
          <li>your plan, and if you have Pro, whether monitoring is on and when we last checked;</li>
          <li>the names of breaches we&apos;ve already reported to you, so we only alert you about new ones;</li>
          <li>the alerts we&apos;ve sent you and the progress of your data broker removals.</li>
        </ul>
        <p>Accounts have no passwords. You sign in with a one-time code sent to your email.</p>
        <h3>Scan results</h3>
        <p>
          A scan streams results straight to your browser. We don&apos;t keep a copy of your report on our servers; it disappears when you close
          the tab, which is why you can download your removal plan as a file. For monitored accounts we keep only the breach names listed above.
        </p>
        <p>
          We record <strong>that</strong> your details appeared in a breach and which kinds of data were exposed. We never download, store or
          show the leaked records themselves.
        </p>
        <h3>Technical data</h3>
        <p>
          Your IP address is used to rate-limit requests and stop abuse. For that it&apos;s held only in the server&apos;s memory, never written
          to disk, and each limit lasts at most 24 hours. Our hosting provider keeps standard server logs (IP address, time, requested page) for
          security, for a limited period. We don&apos;t use analytics services or advertising trackers.
        </p>
        <p>
          To see where people give up, we count how many times a day each step happens: the home page opening, a verification starting, a
          scan starting and finishing, and Pro being reserved. These are bare daily totals. They carry no IP address, cookie, identifier or
          anything else that could tell visitors apart.
        </p>
        <h3>Pro waitlist</h3>
        <p>
          If you reserve Pro before it goes on sale, we keep the email address you gave, when you reserved and where on the site you did it,
          so we can tell you when Pro opens and honour the early-access price. Nothing is charged. Deleting your account removes you from the
          list, and you can ask us to remove you at any time.
        </p>
        <h3>Free scan records</h3>
        <p>
          The free plan includes one scan per person. To enforce that, when you run a free scan we store a keyed hash of your IP address, of
          each detail you scanned and of your account email, if you&apos;re signed in. A keyed hash is a one-way fingerprint made with a secret
          only our server knows: it lets us recognise a repeat, but it can&apos;t be turned back into your address or details. We keep the IP
          fingerprint for 30 days and the others for a year, including after you delete your account, so deleting and signing up again
          doesn&apos;t reset the free scan.
        </p>
      </>
    ),
  },
  {
    id: "how-scans-work",
    title: "How a scan uses your details",
    body: (
      <>
        <p>
          To find where you&apos;re exposed, a scan has to ask other services about the details you entered. Depending on the detail, we send it
          to:
        </p>
        <ul>
          <li>
            <strong>Breach indexes</strong> (Have I Been Pwned, or XposedOrNot): your email address, to look up known breaches. Monitoring
            repeats this lookup for Pro accounts.
          </li>
          <li>
            <strong>Gravatar</strong>: a SHA-256 hash of your email address, to see whether a public Gravatar profile is linked to it.
          </li>
          <li>
            <strong>Open leak indexes</strong> (LeakCheck and Hudson Rock): your email address, username or phone number, to look up leaks
            circulating publicly and infostealer logs. They tell us the names and dates of leaks; we never receive or keep the leaked records.
          </li>
          <li>
            <strong>Popular services</strong> (Spotify, Microsoft, Adobe, X, Snapchat, Duolingo, Chess.com, LastPass, WordPress.com, Freelancer
            and MeWe): your email address, through the same check their sign-up or sign-in page uses, to see whether it has an account there.
            Nothing is sent to you and no account is created.
          </li>
          <li>
            <strong>GitHub and PGP key servers</strong>: your email address, to find public commits and encryption keys that publish it.
          </li>
          <li>
            <strong>Caller-ID sites</strong> (800notes, WhoCallsMe and Should I Answer): US and Canadian phone numbers, by opening the page each
            site has for the number.
          </li>
          <li>
            <strong>Public websites</strong>: your username, by requesting the profile address it would have on 7,000+ sites. Each site sees an
            ordinary request from our servers, not from you.
          </li>
          <li>
            <strong>Search engines</strong>: your detail as a search query. Every scan uses DuckDuckGo, Bing and public SearXNG instances (and the
            Brave Search API when it&apos;s enabled). The Pro deep scan also searches Google, Brave Search, Startpage, Yandex, Ecosia and Qwant
            in a browser on our servers, and opens a few social networks that only show profiles in a browser.
          </li>
          <li>
            <strong>Web archives</strong> (the Wayback Machine and archive.today): your username, to find saved copies of profile pages.
          </li>
        </ul>
        <p>
          These services receive the query because that&apos;s how searching works; they don&apos;t receive your name, account or any link back
          to you. Each handles queries under its own privacy policy. They aren&apos;t our processors: we query them the same way anyone can.
        </p>
        <h3>AI analysis</h3>
        <p>
          Only the Pro deep scan uses AI. The free scan&apos;s report is ranked by fixed rules on our server, and nothing from it is sent to an AI
          provider. For a deep scan, the findings are sent to the provider listed under &ldquo;Who we share it with&rdquo;, with emails and phone
          numbers masked first. While Pro is invite-only, this can run on Google&apos;s unpaid Gemini API tier, under whose terms Google may use
          what it receives to improve its products. We&apos;ll move to paid terms, which don&apos;t allow that, before Pro goes on sale.
        </p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <>
        <p>Under the GDPR and UK GDPR we rely on these legal bases:</p>
        <LegalTable
          head={["Purpose", "Legal basis"]}
          rows={[
            ["Verifying your details and running the scans you ask for", "Performance of a contract (Art. 6(1)(b))"],
            ["Your account, monitoring and alerts", "Performance of a contract (Art. 6(1)(b))"],
            ["Rate limiting, abuse prevention and security logs", "Legitimate interests in keeping the service safe (Art. 6(1)(f))"],
            ["Free scan records, so the free plan can't be used again and again", "Legitimate interests in preventing abuse of the free plan (Art. 6(1)(f))"],
            ["The Pro waitlist, to tell you when Pro opens", "Consent, given when you reserve (Art. 6(1)(a)); withdraw it at any time"],
            ["Daily step counts, to improve the product", "No personal data is involved"],
            ["Answering your emails and privacy requests", "Legitimate interests, or legal obligation where the law requires a reply"],
            ...(LEGAL.paymentProcessor ? [["Keeping records the law requires, such as invoices", "Legal obligation (Art. 6(1)(c))"]] : []),
          ]}
        />
        <p>
          We don&apos;t make decisions about you that have legal or similarly significant effects based solely on automated processing. The AI
          analysis only ranks and explains your own scan results.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>
          <strong>We never sell your personal data or share it for advertising.</strong> We share it only with the service providers
          (&ldquo;processors&rdquo;) below, under contracts that limit them to processing it on our behalf:
        </p>
        <LegalTable head={["Provider", "What for", "What they receive", "Location"]} rows={processors} />
        <p>
          We may also disclose data if the law requires it, for example to answer a valid court order, and we&apos;ll tell you unless we&apos;re
          prohibited from doing so. If {LEGAL.product} is ever sold or merged, this policy will keep applying to your data, and we&apos;ll notify
          you before anything changes.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Your account database is hosted in the {LEGAL.hosting.location}. Some of the providers above are in the United States. When personal
        data leaves the EEA or UK, we rely on the EU&ndash;US Data Privacy Framework where the provider is certified, and otherwise on the European
        Commission&apos;s Standard Contractual Clauses (and the UK Addendum), together with the extra safeguards described on our{" "}
        <Link href="/security">Security</Link> page. You can ask us for a copy of the relevant safeguards.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <LegalTable
        head={["Data", "Kept for"]}
        rows={[
          ["Verification codes", "10 minutes, then the token expires"],
          ["Telegram phone checks (hashed number and chat ID)", "Until the check is used, at most 10 minutes"],
          ["Proof that you verified a detail (outside an account)", "1 hour"],
          ["Scan reports", "Not stored on our servers"],
          ["IP addresses for rate limiting", "Up to 24 hours, in memory only"],
          ["Free scan records (keyed hashes of your IP address)", "30 days"],
          ["Free scan records (keyed hashes of scanned details and account email)", "1 year, also after account deletion"],
          ["Account data, alerts and broker progress", "Until you delete your account"],
          ["Pro waitlist entry", "Until Pro opens and we've told you, then deleted unless you subscribe; or sooner if you ask"],
          ["Daily step counts", "Indefinitely: they contain no personal data"],
          ["Server logs kept by our hosting provider", "As set by the provider, for security"],
          ["Backups", `Overwritten within ${LEGAL.backupDays} days of deletion`],
          ...(LEGAL.paymentProcessor ? [["Billing records", "As long as tax law requires, usually 6 to 10 years"]] : []),
        ]}
      />
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Wherever you live, you can:</p>
        <ul>
          <li>
            <strong>Delete your account</strong> in one step from your dashboard. Your account, everything linked to it and your place on the
            Pro waitlist are erased immediately. Only the free scan fingerprints described above stay.
          </li>
          <li>
            <strong>Get a copy</strong> of your data, or ask us to correct it, by email.
          </li>
          <li>
            <strong>Turn monitoring off</strong> at any time from your dashboard, if you have Pro.
          </li>
          <li>
            <strong>Leave the Pro waitlist</strong> by emailing us, without creating an account.
          </li>
        </ul>
        <h3>EEA, UK and Switzerland</h3>
        <p>
          You have the right to access, rectify, erase, restrict, port and object to the processing of your personal data. You can also complain
          to your local data protection authority, though we&apos;d appreciate the chance to fix things first.
        </p>
        <h3>California and other US states</h3>
        <p>
          Under the CCPA/CPRA and similar state laws you can know, delete and correct the personal information we hold, and opt out of its sale
          or sharing. We don&apos;t sell or share personal information as those laws define it, and we don&apos;t use sensitive personal
          information to infer anything about you. We won&apos;t treat you differently for using your rights. We honor Global Privacy Control
          signals, though there&apos;s nothing for them to switch off.
        </p>
        <p>
          To use any right, email {mail(LEGAL.email.privacy)} from the address on your account. We may ask you to confirm a code to make sure the
          request is really yours.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use a single, strictly necessary cookie to keep you signed in, and no analytics or advertising cookies. The details are on our{" "}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        {LEGAL.product} is not meant for anyone under {LEGAL.minimumAge}. We don&apos;t knowingly collect data from children; if you believe a
        child has given us their details, contact {mail(LEGAL.email.privacy)} and we&apos;ll delete them.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        When we change this policy, we update the date at the top. If a change materially affects how we use your data, we&apos;ll email account
        holders at least 14 days before it takes effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy Policy"
      intro={
        <p>
          {LEGAL.product} exists to shrink your digital footprint, so we hold ourselves to the same standard. This policy explains what we collect,
          why, and how you stay in control.
        </p>
      }
      glance={[
        "We only scan emails and phone numbers you've proved are yours. Usernames can't be proven, so they're scanned as entered.",
        "Scan reports are streamed to your browser and not kept on our servers.",
        "We never download or store leaked records, only the fact that your details appeared in a breach.",
        "No passwords, no analytics, no ad trackers, and we never sell your data.",
        "Delete your account in one step and everything is erased immediately.",
      ]}
      sections={sections}
    />
  );
}
