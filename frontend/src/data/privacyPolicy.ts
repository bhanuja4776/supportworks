// Static Privacy Policy content (Privacy Act 1988 (Cth) / Australian
// Privacy Principles). Ported from the old backend's privacy_policy.py —
// kept as static frontend data rather than an API call since the content
// itself never changes at runtime; only PRIVACY_POLICY_VERSION changing
// should ever prompt re-acceptance (see AuthContext's needsConsent check).
export const PRIVACY_POLICY_VERSION = "1.0";
export const PRIVACY_POLICY_UPDATED = "2026-06-01";

export const PRIVACY_POLICY_TEXT = `# Privacy Policy — NDIS Command Center

This Privacy Policy explains how NDIS Command Center ("the App", "we", "us") collects, holds, uses and discloses personal information, in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs). By accepting this policy you consent to the practices described below.

## 1. Who this policy covers
The App is a business-management tool for disability support workers and providers in Australia. It handles two categories of information: (a) your information as the account holder, and (b) information you record about the NDIS participants you support.

## 2. What we collect
- Account details: your name, email address and optional profile photo, managed through your sign-in provider.
- Business details: business name, ABN, contact details and payment details (account name, BSB, account number) used to generate your invoices.
- Participant records you create: names, NDIS numbers, contact details, next-of-kin contacts, care notes, budgets, documents and related records. This may include health information, which is sensitive information under the Privacy Act.
- Financial records: invoices, receipts, expenses and bank-statement lines you choose to import for reconciliation. We never ask for, or store, your bank login credentials.
- Photos and documents you capture in the App (e.g. receipts).
- Technical data strictly required to operate the service, such as your account session.

## 3. Why we collect it (APP 3 & 6)
We collect and use this information solely to provide the App's features to you: creating NDIS-compliant invoices, keeping shift and care records, planning your day, generating reports, and syncing your data across your devices. We do not sell personal information, use it for advertising, or disclose it for any secondary purpose without your consent, unless required by law.

## 4. Sensitive information and participant consent
Care notes and health-related records about participants are sensitive information. You should only record participant information you are authorised to hold, and you remain responsible for obtaining any consent required from participants (or their guardians) under the Privacy Act and the NDIS Code of Conduct. The App provides access controls, encryption in transit and per-account data isolation to help you meet your own obligations.

## 5. AI features (optional)
Some features (such as receipt scanning) send the specific content you submit to a secure large-language-model API (OpenAI, via an encrypted connection) to produce a result. This content is used only to generate your result, is not used to train AI models, and is not retained by us beyond the produced output. You choose when to use these features — they never run in the background.

## 6. Disclosure to third parties (APP 6 & 8)
We use a small number of service providers to run the App: Google Firebase (authentication, data storage and hosting) and, where relevant, an AI provider for the features described above. Some providers may process data outside Australia (for example, in the United States). We take reasonable steps to ensure such providers handle personal information consistently with the APPs.

## 7. Security (APP 11)
- All data is transmitted over encrypted connections (TLS).
- Every record is isolated to your account and every request requires authentication.
- Access to your data is governed by your account's sign-in credentials.

## 8. Data retention and deletion
Your data is retained while your account is active so the App can function. Note that NDIS providers may have independent record-keeping obligations (commonly 7 years for service and financial records) — consider exporting what you must keep before deleting your account.

## 9. Access and correction (APP 12 & 13)
You can view and edit your information directly in the App at any time. You may also request a copy of, or correction to, the personal information we hold about you by contacting us through the in-app Help section.

## 10. Data breaches
We follow the Notifiable Data Breaches (NDB) scheme. If a breach of personal information is likely to result in serious harm, we will notify you and the Office of the Australian Information Commissioner (OAIC) as required by law.

## 11. Complaints
If you believe we have mishandled your personal information, please contact us first through the in-app Help section and we will respond promptly. If you are not satisfied with our response, you may complain to the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au or 1300 363 992.

## 12. Changes to this policy
If we make material changes, the App will present the updated policy for your review and acceptance before you continue. The version and date you accepted are recorded on your account.

## 13. Contact
Questions about this policy or your data can be sent via the in-app Help & Support section.
`;
