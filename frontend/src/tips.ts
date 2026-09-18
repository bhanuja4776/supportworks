// Rotating educational tips + app-value messages for support workers.
// NOTE: English-only for now. i18n is intentionally deferred (see TODO in PRD) —
// translations will be batched once feature work settles.
export type TipCategory =
  | "invoicing" | "payments" | "ndis" | "compliance" | "medication"
  | "safety" | "tax" | "wellbeing" | "app";

export type Tip = { c: TipCategory; t: string };

export const TIPS: Tip[] = [
  // --- Invoicing & payments ---
  { c: "payments", t: "Invoicing: the plan manager or participant reviews your invoice and processes payment — usually within 7 to 14 business days." },
  { c: "payments", t: "Most NDIS supports are GST-free — don't add GST to NDIS line items unless it genuinely applies." },
  { c: "invoicing", t: "A compliant NDIS invoice needs your name & ABN, the participant's name, the date, the support item number, hours/quantity, unit price and total." },
  { c: "payments", t: "Self-managed participants pay you directly; plan-managed goes through their plan manager; agency-managed is claimed via the NDIS portal." },
  { c: "invoicing", t: "Send invoices promptly — the sooner you invoice, the sooner you're paid, and the healthier your cash flow stays." },
  { c: "invoicing", t: "Keep invoice numbers sequential and unique — it makes matching payments to invoices far easier at tax time." },
  { c: "invoicing", t: "State clear payment terms on every invoice (e.g. 7 or 14 days) so everyone knows exactly when payment is due." },
  { c: "invoicing", t: "Always bill the support you actually delivered — accurate hours protect you if a claim is ever reviewed." },
  { c: "invoicing", t: "Travel and non-labour costs often use separate NDIS line items — check the Price Guide before claiming them." },

  // --- NDIS knowledge & compliance ---
  { c: "ndis", t: "Only claim supports that are in the participant's plan and are 'reasonable and necessary' for their goals." },
  { c: "ndis", t: "Support prices have caps set by the NDIS Pricing Arrangements — you can charge up to, but never above, the limit." },
  { c: "ndis", t: "Weekday, evening, weekend and public-holiday supports usually have different codes and higher rates — pick the right one." },
  { c: "compliance", t: "An NDIS Worker Screening Check is required to deliver many supports — keep yours current and know its expiry." },
  { c: "compliance", t: "The free NDIS Worker Orientation Module 'Quality, Safety and You' is often required by providers — worth completing early." },
  { c: "compliance", t: "Report incidents promptly and in writing — reportable incidents to the NDIS Commission have strict timeframes." },
  { c: "ndis", t: "Person-centred support means the participant leads the decisions about their own care, routines and goals." },
  { c: "compliance", t: "Respect participant privacy — share their information only on a need-to-know basis and with consent." },
  { c: "compliance", t: "Keep professional boundaries: you're there to support independence, not to make decisions for the person." },

  // --- Medication ---
  { c: "medication", t: "Support workers generally 'assist' with medication (prompting, opening Webster-paks) rather than prescribe or make clinical calls." },
  { c: "medication", t: "Always follow the participant's medication management plan and only give what is clearly documented." },
  { c: "medication", t: "If a medication error occurs, follow your policy, seek medical advice if needed, and document it straight away." },
  { c: "medication", t: "Schedule 8 (controlled) medications carry extra storage and recording rules — know your organisation's policy." },

  // --- Safety & first aid ---
  { c: "safety", t: "Keep a current First Aid and CPR certificate — CPR should be refreshed every 12 months." },
  { c: "safety", t: "Do a quick risk check before manual handling; use aids and correct technique to protect you and the participant." },
  { c: "safety", t: "Know each participant's emergency plan and key contacts before your shift starts." },
  { c: "safety", t: "Infection-control basics — hand hygiene and PPE — protect both you and the people you support." },

  // --- Tax, ABN & records ---
  { c: "tax", t: "As a sole trader you need an ABN to invoice for your support work." },
  { c: "tax", t: "You must register for GST once your business turnover reaches $75,000 in a 12-month period." },
  { c: "tax", t: "Set aside part of every payment for tax — as a sole trader, no one withholds it for you." },
  { c: "tax", t: "Keep your business records and receipts for at least 5 years — it's an ATO requirement." },
  { c: "tax", t: "Track deductible expenses — car, phone, training, insurance — they lower your taxable income." },
  { c: "tax", t: "Public liability and professional indemnity insurance are strongly recommended for independent support workers." },
  { c: "tax", t: "Log your work-related car trips so you can correctly claim travel at tax time." },

  // --- Wellbeing ---
  { c: "wellbeing", t: "Support work can be emotionally demanding — schedule breaks and debrief when you need to." },
  { c: "wellbeing", t: "Clear notes at the end of each shift save you time later and protect you if questions ever come up." },

  // --- App value (educational + how this app helps) ---
  { c: "app", t: "Everything in one place: clients, invoices, receipts and NDIS codes — no more juggling spreadsheets and photo rolls." },
  { c: "app", t: "Scan a receipt and the app reads the merchant, date, GST and total for you — no manual typing." },
  { c: "app", t: "Plan a shift ahead of time and the app pre-builds a ready-to-finish draft invoice for each client." },
  { c: "app", t: "The compliance checklist on every invoice flags what's missing before you send — fewer rejected claims." },
  { c: "app", t: "Bill several participants from one screen — the app splits it into a separate compliant invoice for each." },
  { c: "app", t: "Bank Reconcile matches your deposits to invoices and marks them paid — your BAS updates instantly." },
  { c: "app", t: "Reports & BAS builds your GST summary automatically from paid invoices and logged receipts." },
  { c: "app", t: "The NDIS Code Assistant helps you pick the right support item in seconds — just describe what you did." },
  { c: "app", t: "Store your certificates and insurances in the app and get a heads-up before they expire." },
  { c: "app", t: "Dictate invoice descriptions and notes with your voice instead of typing on a small screen." },
  { c: "app", t: "Save your logo, ABN and bank details once — they're added to every invoice automatically." },
  { c: "app", t: "Track each participant's plan budget so you always know how much is left before you claim." },
  { c: "app", t: "Admin like invoicing and receipts can quietly eat unpaid hours each week — one central app cuts that time right down." },
  { c: "app", t: "Export invoices and receipts to Excel any time — handy for your accountant or BAS lodgement." },
  { c: "app", t: "Set 2-factor authentication to keep your clients' sensitive information secure." },
  { c: "app", t: "Set per-client reminders — like renewing a service agreement — so nothing slips through the cracks." },
  { c: "app", t: "Available in 9 languages — switch anytime from Account → Language." },
];

export const TIP_STYLE: Record<TipCategory, { icon: string; label: string }> = {
  invoicing: { icon: "document-text", label: "Invoicing" },
  payments: { icon: "cash", label: "Payments" },
  ndis: { icon: "shield-checkmark", label: "NDIS" },
  compliance: { icon: "ribbon", label: "Compliance" },
  medication: { icon: "medkit", label: "Medication" },
  safety: { icon: "fitness", label: "Safety" },
  tax: { icon: "calculator", label: "Tax & ABN" },
  wellbeing: { icon: "heart", label: "Wellbeing" },
  app: { icon: "sparkles", label: "Did you know?" },
};
