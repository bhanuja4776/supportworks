// Real-world NDIS disability-support FAQ questions, grouped by category.
// Used by the Code Assistant to guide users with relevant, tappable prompts.

export type FaqCategory = {
  key: string;
  label: string;
  icon: string; // Ionicons name
  questions: string[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    key: "personal_care",
    label: "Personal Care",
    icon: "body",
    questions: [
      "Which code do I use for showering and dressing a participant on a weekday morning?",
      "What's the code for assisting with toileting and continence support?",
      "How do I bill for helping a participant with meal preparation and eating?",
      "What code covers overnight active personal care?",
      "Is there a separate code for medication prompting and assistance?",
      "Which code applies for assistance with mobility and transfers at home?",
      "What's the right code for morning routine support on a Saturday?",
    ],
  },
  {
    key: "community",
    label: "Community Access",
    icon: "people",
    questions: [
      "What code covers taking a participant to the shops or a social outing?",
      "Which code is for supporting a participant to attend a community group?",
      "How do I bill 1:1 support to access sport or recreation in the community?",
      "What's the code for supporting a participant at a medical appointment?",
      "Is there a group ratio code (1:2 or 1:3) for community participation?",
      "Which code applies to developing daily living skills in the community?",
      "What code do I use for supporting someone to attend an art or music class?",
    ],
  },
  {
    key: "household",
    label: "Household Tasks",
    icon: "home",
    questions: [
      "What's the code for cleaning the participant's home?",
      "Which code covers laundry and linen changes?",
      "How do I bill for help with grocery shopping and putting it away?",
      "What code is used for yard maintenance or gardening?",
      "Is house cleaning a support I can claim, or is it the participant's cost?",
      "Which code covers meal delivery or preparing meals in bulk?",
    ],
  },
  {
    key: "transport",
    label: "Transport & Travel",
    icon: "car",
    questions: [
      "How do I claim provider travel time to reach a participant?",
      "What's the difference between activity-based transport and provider travel?",
      "Which code covers transporting a participant in my own car?",
      "Can I claim kilometres, and what code or line item is that?",
      "How do I bill travel between two participants on the same day?",
      "What are the rules for claiming non-labour transport costs?",
    ],
  },
  {
    key: "rates_times",
    label: "Rates & Times",
    icon: "time",
    questions: [
      "Is there a higher rate for support provided on a public holiday?",
      "What counts as evening vs night vs daytime for rate purposes?",
      "Which code applies for Saturday support versus Sunday support?",
      "How does the weekday/weekend loading change the code I use?",
      "What's the code for a sleepover / inactive overnight support?",
      "Do the price limits differ by state or region?",
    ],
  },
  {
    key: "cancellations",
    label: "Cancellations",
    icon: "close-circle",
    questions: [
      "How do I claim a short-notice cancellation or no-show?",
      "What's the current cancellation rule and how much can I claim?",
      "Do I use the same support code for a cancelled shift?",
      "How many cancellations can be claimed before it's a problem?",
      "What counts as adequate notice for a cancellation?",
    ],
  },
  {
    key: "reporting",
    label: "Reporting & Compliance",
    icon: "document-text",
    questions: [
      "What information must a compliant NDIS invoice include?",
      "How do I know if a support is in the participant's plan?",
      "What's the difference between self-managed, plan-managed and agency-managed?",
      "Do I need to keep case notes for every shift I claim?",
      "What are stated supports and how do they affect what I can claim?",
      "How do I make sure my claim stays within the price limit?",
    ],
  },
  {
    key: "capacity",
    label: "Capacity Building",
    icon: "trending-up",
    questions: [
      "Which code covers support coordination?",
      "What's the code for improved daily living skills development?",
      "How do I bill for building a participant's independence and life skills?",
      "Is there a code for supporting employment or finding a job?",
      "What code applies to skills training for community participation?",
    ],
  },
  {
    key: "complex_care",
    label: "High Intensity",
    icon: "medkit",
    questions: [
      "Which code applies for high intensity daily personal activities?",
      "What's the code for support involving complex bowel care?",
      "How do I bill support that needs high-intensity skills like PEG feeding?",
      "Is there a higher rate when a participant has complex behaviour support needs?",
      "What code covers support requiring subcutaneous injections or wound care?",
    ],
  },
  {
    // ---- ABN Sole Trader / NDIS Commission compliance ----
    // Covers ABN setup, GST thresholds, worker screening, insurance,
    // incident reporting to the NDIS Quality & Safeguards Commission,
    // and general record-keeping obligations for a newly-independent DSW.
    key: "sole_trader_compliance",
    label: "Sole Trader Setup",
    icon: "shield-checkmark",
    questions: [
      "As an ABN sole trader, when do I need to register for GST?",
      "How much do I need to earn before charging GST on my invoices?",
      "Do NDIS supports include GST or are they GST-free?",
      "What insurance should I hold as a sole-trader disability support worker?",
      "Is public liability and professional indemnity insurance mandatory?",
      "Do I need an NDIS Worker Screening Check as an unregistered provider?",
      "What's the difference between a registered and unregistered NDIS provider?",
      "How long do I need to keep invoices and case notes for tax purposes?",
      "What income do I report on my BAS and how often?",
      "Am I required to pay quarterly PAYG instalments as a sole trader?",
      "Do I have to pay my own super, and how much should I set aside?",
      "What deductions can I claim — car, phone, home office, uniform?",
      "How do I set aside tax and super each week so I'm not caught out?",
    ],
  },
  {
    // ---- Safety & first-response duties ----
    // These are the exact scenarios every DSW must be confident with,
    // and mirror the questions that show up in the monthly compliance quiz.
    key: "safety_first_aid",
    label: "Safety & First Aid",
    icon: "medkit-outline",
    questions: [
      "How current does my First Aid & CPR certificate need to be?",
      "What are the first three steps when someone is choking?",
      "How do I administer an EpiPen for anaphylaxis?",
      "What's the DRSABCD action plan and when do I use it?",
      "What are the signs of a stroke I need to recognise?",
      "What should I do during a tonic-clonic seizure?",
      "When must I call 000 versus non-emergency 13 SICK (13 74 25)?",
      "What are the signs of choking versus a blocked airway?",
      "How do I safely perform CPR on an adult versus a child?",
      "What's the recovery position and when do I use it?"
    ],
  },
  {
    // ---- Incident reporting & mandatory obligations ----
    key: "incidents_reporting",
    label: "Incidents & Reporting",
    icon: "warning",
    questions: [
      "What's a reportable incident under NDIS Commission rules?",
      "How quickly must I lodge a reportable incident (24 vs 5 business days)?",
      "Which incidents trigger mandatory reporting to police?",
      "What's the difference between a reportable incident and a near-miss?",
      "Do I need to write a case note for every incident, even minor?",
      "How do I lodge a complaint or feedback to the NDIS Commission?",
      "What's the NDIS Code of Conduct and how does it apply to me?",
      "When must I escalate suspected abuse or neglect?",
      "How do I document restrictive practices safely and legally?"
    ],
  },
];

// Flat list of all questions for the randomised "Try asking" shuffle.
export const ALL_FAQ_QUESTIONS: string[] = FAQ_CATEGORIES.flatMap((c) => c.questions);

// Pick n random unique items from a list, optionally excluding some.
export function pickRandom(pool: string[], n: number, exclude: string[] = []): string[] {
  const avail = pool.filter((q) => !exclude.includes(q));
  const shuffled = [...avail];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
