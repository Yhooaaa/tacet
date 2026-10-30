export type Broker = {
  id: string;
  name: string;
  region: "US" | "UK";
  url: string;
  shows: string[];
  steps: string[];
  minutes: number;
  takes: string;
  note?: string;
};

export const RELIST_DAYS = 90;

export const BROKERS: Broker[] = [
  {
    id: "spokeo",
    name: "Spokeo",
    region: "US",
    url: "https://www.spokeo.com/optout",
    shows: ["Name", "Address", "Phone", "Email", "Relatives"],
    steps: [
      "Search your name on spokeo.com and open your listing.",
      "Copy the listing's web address.",
      "Paste it into the opt-out form with your email and submit.",
      "Click the confirmation link Spokeo emails you.",
    ],
    minutes: 5,
    takes: "Usually a few days",
    note: "AnyWho listings are now handled by this same form.",
  },
  {
    id: "whitepages",
    name: "Whitepages",
    region: "US",
    url: "https://www.whitepages.com/suppression-requests",
    shows: ["Name", "Address", "Phone", "Age", "Relatives"],
    steps: [
      "Find your listing on whitepages.com and copy its web address. Use View details, not the paid report.",
      "Paste the address into the suppression form and click Next.",
      "Confirm it's your listing and click Remove me.",
      "Answer the verification call and enter the code it gives you.",
    ],
    minutes: 15,
    takes: "Up to 72 hours",
    note: "Each listing needs its own request. Needs a phone that can take a verification call.",
  },
  {
    id: "beenverified",
    name: "BeenVerified",
    region: "US",
    url: "https://www.beenverified.com/app/optout/search",
    shows: ["Name", "Address", "Phone", "Email", "Relatives", "Court records"],
    steps: [
      "Enter your first and last name and choose your state.",
      "Find your record and click Proceed to opt out.",
      "Enter an email address and complete the captcha.",
      "Click Verify opt-out in the email BeenVerified sends.",
    ],
    minutes: 5,
    takes: "24 to 72 hours",
    note: "If you have several records, email privacy@beenverified.com.",
  },
  {
    id: "peopleconnect",
    name: "Intelius, TruthFinder and Instant Checkmate",
    region: "US",
    url: "https://suppression.peopleconnect.us/login",
    shows: ["Name", "Address", "Phone", "Email", "Relatives", "Court records"],
    steps: [
      "Sign in to the PeopleConnect suppression center with your email.",
      "Confirm the code it emails you.",
      "Search for your record and choose Suppress.",
    ],
    minutes: 10,
    takes: "Usually within a week",
    note: "One request covers all PeopleConnect sites.",
  },
  {
    id: "truepeoplesearch",
    name: "TruePeopleSearch",
    region: "US",
    url: "https://www.truepeoplesearch.com/removal",
    shows: ["Name", "Address", "Phone", "Email", "Relatives"],
    steps: [
      "Enter your email, tick the box confirming the record is yours, and complete the captcha.",
      "Click Begin removal, then find and select your record.",
      "Confirm the removal from the email you receive.",
    ],
    minutes: 5,
    takes: "Up to 72 hours",
  },
  {
    id: "fastpeoplesearch",
    name: "FastPeopleSearch",
    region: "US",
    url: "https://www.fastpeoplesearch.com/removal",
    shows: ["Name", "Address", "Phone", "Email", "Relatives"],
    steps: [
      "Enter your email, tick the agreement box and complete the captcha.",
      "Find your record and request removal.",
      "Confirm from the email you receive.",
    ],
    minutes: 5,
    takes: "Up to 72 hours",
    note: "If the page doesn't load, try fastpeoplesearch.com/optout. Removal is always free.",
  },
  {
    id: "usphonebook",
    name: "USPhoneBook",
    region: "US",
    url: "https://www.usphonebook.com/opt-out",
    shows: ["Name", "Phone", "Address"],
    steps: [
      "Enter your email and tick the box to agree to the terms.",
      "Click Begin removal request and select your record.",
      "Click the confirmation link in the email within 24 hours.",
    ],
    minutes: 5,
    takes: "Up to 72 hours",
  },
  {
    id: "mylife",
    name: "MyLife",
    region: "US",
    url: "https://www.mylife.com/ccpa/index.pubview",
    shows: ["Name", "Address", "Age", "Relatives", "Reputation score"],
    steps: [
      "Search your name on mylife.com and copy your profile's web address.",
      "Submit it on the CCPA opt-out form.",
      "Watch for a confirmation email.",
    ],
    minutes: 5,
    takes: "24 to 48 hours",
  },
  {
    id: "familytreenow",
    name: "FamilyTreeNow",
    region: "US",
    url: "https://www.familytreenow.com/",
    shows: ["Name", "Address", "Phone", "Relatives"],
    steps: [
      "Open Do not sell my personal information at the bottom of the homepage.",
      "Under How to delete, open the opt-out tool.",
      "Find your record, request removal and confirm by email.",
    ],
    minutes: 10,
    takes: "About 72 hours",
    note: "The opt-out tool isn't linked from the main menu.",
  },
  {
    id: "thatsthem",
    name: "ThatsThem",
    region: "US",
    url: "https://thatsthem.com/optout",
    shows: ["Name", "Address", "Phone", "Email", "IP address"],
    steps: ["Fill in the opt-out form with the details shown on your listing.", "Submit the form and keep the confirmation."],
    minutes: 5,
    takes: "Up to a few weeks",
  },
  {
    id: "infotracer",
    name: "InfoTracer",
    region: "US",
    url: "https://infotracer.com/optout/",
    shows: ["Name", "Address", "Phone", "Court records"],
    steps: ["Fill in the opt-out form with your details.", "Confirm from the email you receive."],
    minutes: 5,
    takes: "Up to a few weeks",
  },
  {
    id: "acxiom",
    name: "Acxiom",
    region: "US",
    url: "https://isapps.acxiom.com/optout/optout.aspx",
    shows: ["Marketing profile", "Address", "Email", "Interests"],
    steps: ["Fill in the opt-out form for marketing data.", "Confirm from the email you receive."],
    minutes: 5,
    takes: "Up to a few weeks",
    note: "A marketing data broker: you won't see a public listing, but it feeds many others.",
  },
  {
    id: "lexisnexis",
    name: "LexisNexis",
    region: "US",
    url: "https://consumer.risk.lexisnexis.com/opt",
    shows: ["Name", "Address history", "Phone", "Public records"],
    steps: ["Choose the opt-out request type that fits you.", "Fill in the form and submit it.", "Watch for a confirmation by email or post."],
    minutes: 10,
    takes: "Up to 30 days",
  },
  {
    id: "192com",
    name: "192.com",
    region: "UK",
    url: "https://www.192.com/",
    shows: ["Name", "Address", "Age", "Household members"],
    steps: [
      "Use the self-removal form in 192.com's help section.",
      "Confirm from the email you receive.",
      "Opt out of the open electoral register too, or your record can come back when 192.com refreshes.",
    ],
    minutes: 10,
    takes: "24 to 48 hours",
    note: "Opt out of the open register at gov.uk/electoral-register/opt-out-of-the-open-register.",
  },
  {
    id: "ukphonebook",
    name: "UK Phonebook",
    region: "UK",
    url: "https://www.ukphonebook.com/opt-out",
    shows: ["Name", "Address", "Phone"],
    steps: ["Fill in the opt-out form with the details on your listing.", "Submit it and keep the confirmation."],
    minutes: 5,
    takes: "Up to a few weeks",
  },
];

export type BrokerStatus = "todo" | "submitted" | "removed" | "recheck";

export const BROKER_IDS = new Set(BROKERS.map((b) => b.id));
