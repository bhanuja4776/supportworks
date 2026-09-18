// Cloud Functions replacement for every OpenAI-calling backend endpoint
// (server.py:558-902). These are the ONE genuinely necessary exception to
// "no backend, direct Firestore from the client" in this migration: the
// OpenAI API key must never reach the browser, so the call has to happen
// server-side. onCall() gives request.auth from the caller's verified
// Firebase ID token for free — no bearer-token/session plumbing needed,
// unlike the old FastAPI endpoints.
//
// IMPORTANT — unverified in this environment: OPENAI_API_KEY is empty in
// this dev environment (confirmed via backend/.env), so these endpoints
// already return "LLM key not configured" on the ORIGINAL Mongo backend
// today. These functions reproduce that exact same failure mode when the
// secret is unset — this is a faithful migration of already-nonfunctional
// (in this environment) endpoints, not a regression. Once a real
// OPENAI_API_KEY is set via `firebase functions:secrets:set`, these become
// live without any further code change.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import { consumeAi } from "./limits";
import ndisCatalogue from "./ndis_catalogue.json";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const MAX_IMAGE_B64 = 12 * 1024 * 1024; // ~9MB decoded
const MAX_AUDIO_B64 = 32 * 1024 * 1024; // ~24MB decoded

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required");
  return auth.uid;
}

function checkUploadSize(b64: string, kind: string, maxLen: number) {
  if (!b64) throw new HttpsError("invalid-argument", `No ${kind} provided`);
  const payload = b64.includes(",") && b64.trim().startsWith("data:") ? b64.split(",", 2)[1] : b64;
  if (payload.length > maxLen) {
    throw new HttpsError("invalid-argument", `${kind} too large (max ${Math.floor(maxLen / (1024 * 1024))} MB). Please retry with a smaller file.`);
  }
}

function client(): OpenAI {
  const key = OPENAI_API_KEY.value();
  if (!key) throw new HttpsError("failed-precondition", "LLM key not configured");
  return new OpenAI({ apiKey: key });
}

async function llmComplete(system: string, prompt: string, imageB64?: string): Promise<string> {
  const openai = client();
  const content: any = imageB64
    ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageB64}` } }]
    : prompt;
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: system }, { role: "user", content }],
  });
  return res.choices[0]?.message?.content || "";
}

async function ocrExtractJson(system: string, prompt: string, imageBase64: string, label: string): Promise<any> {
  let b64 = imageBase64;
  if (b64.includes(",") && b64.trim().startsWith("data:")) b64 = b64.split(",", 2)[1];
  try {
    let text = (await llmComplete(system, prompt, b64)).trim();
    if (text.startsWith("```")) {
      text = text.replace(/`/g, "");
      if (text.toLowerCase().startsWith("json")) text = text.slice(4);
    }
    const start = text.indexOf("{"), end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
    return JSON.parse(text);
  } catch (e: any) {
    throw new HttpsError("internal", `Extraction failed: ${e?.message || label}`);
  }
}

const RECEIPT_PROMPT =
  "You are an expert receipt data extraction engine for an Australian NDIS support worker " +
  "business app. Analyse the receipt image and extract the fields. Respond with ONLY a valid " +
  'JSON object, no markdown, no explanation. Schema: {"merchant": string, "abn": string, "receipt_number": string, "date": "YYYY-MM-DD", ' +
  '"subtotal": number, "total": number, "gst": number, ' +
  '"payment_method": string, "category": one of ["Fuel","Meals","Supplies","Equipment","Travel","Utilities","General"], ' +
  '"items": [string], ' +
  '"line_items": [{"description": string, "qty": number, "unit_price": number, "gst_rate": number}], ' +
  '"confidence": number between 0 and 1}. ' +
  "GST in Australia is 10%. If GST is shown separately use it, otherwise estimate total/11. " +
  "\"abn\" is the merchant's Australian Business Number if printed on the receipt (11 digits, " +
  "may have spaces). \"receipt_number\" is the invoice/receipt/transaction number if printed. " +
  "\"line_items\" should list each purchased item's own row exactly as printed — do not merge " +
  "rows or fabricate a breakdown when the receipt only shows a single total. " +
  "Never invent a value for any field. Use an empty string, 0, or an empty array when a field " +
  "is not clearly visible on the receipt — leaving it blank for the user to fill in is always better than guessing.";

const DOCUMENT_PROMPT =
  "You are an expert document digitisation engine for an Australian NDIS support worker " +
  "business app. Analyse the photographed document (e.g. service agreement, NDIS plan, " +
  "consent form, letter, medical report) and extract its content. Respond with ONLY a valid " +
  "JSON object, no markdown, no explanation. Schema: " +
  '{"title": string (short descriptive title), ' +
  '"doc_type": one of ["Service Agreement","Consent","Plan","Document"], ' +
  '"date": "YYYY-MM-DD" (document date if visible, else ""), ' +
  '"key_parties": [string] (names of people/organisations mentioned), ' +
  '"full_text": string (the complete readable text of the document, cleaned and formatted with line breaks), ' +
  '"confidence": number between 0 and 1}. ' +
  "Use empty string/array when a field is not visible.";

const TEXT_OCR_PROMPT =
  "You are an OCR engine. Read all the text visible in this photographed page or document " +
  "and transcribe it faithfully. Respond with ONLY a valid JSON object, no markdown, no " +
  'explanation. Schema: {"text": string, "confidence": number between 0 and 1}. ' +
  "Preserve the document's structure as plain text: keep paragraph breaks, headings on their " +
  "own line, list items on separate lines, and numbers/dates exactly as printed. Do not " +
  "summarise, translate, or reformat the content — transcribe what is actually on the page. " +
  "Never invent or guess text that isn't clearly legible; if part of the image is blurry or " +
  "unreadable, leave that part out rather than fabricating a plausible-looking replacement. " +
  'If no readable text is visible at all, return an empty string for "text" and a low confidence score.';

export const scanReceipt = onCall({ secrets: [OPENAI_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  checkUploadSize(req.data?.image_base64 || "", "image", MAX_IMAGE_B64);
  await consumeAi(uid);
  const data = await ocrExtractJson(
    "You extract structured data from receipt images and return strict JSON.",
    RECEIPT_PROMPT, req.data.image_base64, "scan-receipt",
  );
  return { success: true, data };
});

export const scanDocument = onCall({ secrets: [OPENAI_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  checkUploadSize(req.data?.image_base64 || "", "image", MAX_IMAGE_B64);
  await consumeAi(uid);
  const data = await ocrExtractJson(
    "You extract structured data from photographed documents and return strict JSON.",
    DOCUMENT_PROMPT, req.data.image_base64, "scan-document",
  );
  return { success: true, data };
});

export const scanText = onCall({ secrets: [OPENAI_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  checkUploadSize(req.data?.image_base64 || "", "image", MAX_IMAGE_B64);
  await consumeAi(uid);
  const data = await ocrExtractJson(
    "You transcribe text from photographed documents and return strict JSON.",
    TEXT_OCR_PROMPT, req.data.image_base64, "scan-text",
  );
  return { success: true, data };
});

export const transcribeAudio = onCall({ secrets: [OPENAI_API_KEY], timeoutSeconds: 120 }, async (req) => {
  const uid = requireUid(req.auth);
  const audioBase64: string = req.data?.audio_base64 || "";
  checkUploadSize(audioBase64, "audio", MAX_AUDIO_B64);
  await consumeAi(uid);
  const openai = client();
  let fmt = String(req.data?.format || "m4a").toLowerCase().replace(/^\./, "");
  if (!["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"].includes(fmt)) fmt = "m4a";
  try {
    const buffer = Buffer.from(audioBase64, "base64");
    const file = await OpenAI.toFile(buffer, `audio.${fmt}`);
    const res = await openai.audio.transcriptions.create({ model: "whisper-1", file, response_format: "text" });
    const text = typeof res === "string" ? res : (res as any).text || "";
    return { success: true, text: text.trim() };
  } catch (e: any) {
    throw new HttpsError("internal", `Transcription failed: ${e?.message || "unknown error"}`);
  }
});

// ---------- NDIS support-code assistant ----------
// The full catalogue is only 25 items (see src/ndis.ts on the frontend for
// why this stayed static JSON rather than becoming a Firestore/Mongo
// collection) — well under the original's `total <= 120` "just pass
// everything, don't bother searching" threshold, so the keyword-search
// step from _search_items is dropped entirely: every call always uses the
// full candidate list.
const CATALOGUE_ITEMS: any[] = (ndisCatalogue as any).items || [];
const CATALOGUE_VERSION = (ndisCatalogue as any).version || "";

function itemsForPrompt(items: any[]): string {
  return items.map((i) =>
    `- ${i.code} | ${i.name} | ${i.category || ""} > ${i.subcategory || ""} | $${i.rate ?? ""}/${i.unit ?? ""} | tags: ${(i.tags || []).join(", ")}`
  ).join("\n");
}

function buildAssistantSystem(items: any[], version: string): string {
  return (
    "You are the NDIS Code & Compliance Assistant for a disability support worker in Victoria, Australia. " +
    "You help them (a) pick the correct NDIS support item line code for compliant invoicing and (b) answer " +
    "practical compliance questions for ABN sole traders working under the NDIS.\n\n" +
    "STRICT RULES:\n" +
    "1. Recommend codes ONLY from the CANDIDATE CODES below. Never invent a code number.\n" +
    "2. If the right support code is not among the candidates, say so plainly and tell them to check the official " +
    "NDIS Pricing Arrangements & Price Limits (Price Guide) — do NOT guess a code.\n" +
    "3. Keep answers SHORT and plain-English. Lead with the recommended code (if applicable) and one-line why. " +
    "For non-code compliance questions, lead with the direct answer, then a one-line 'source/authority' cue.\n" +
    "4. When day/time or ratio matters (weekday/evening/weekend/public holiday, self-care vs community), " +
    "briefly note which variant applies.\n" +
    "5. Add a short compliance reminder when relevant (e.g. must be in the participant's plan/stated supports, " +
    "within price limits, and actually delivered). You are guidance, not financial or legal advice.\n" +
    "6. Never fabricate rates; use the catalogue rate.\n\n" +
    "COMPLIANCE TOPICS you may answer (for ABN sole-trader disability support workers):\n" +
    "• NDIS Practice Standards & Code of Conduct (NDIS Quality and Safeguards Commission).\n" +
    "• Reportable incidents to the NDIS Commission (24-hour vs 5-business-day categories, mandatory reporting to police).\n" +
    "• Worker Screening Check requirements and validity.\n" +
    "• GST registration threshold ($75,000/yr for sole traders) and how it affects invoices; most NDIS supports are GST-free.\n" +
    "• ATO obligations: BAS, PAYG instalments, income averaging, deductions common to DSWs (car, phone, PPE, training).\n" +
    "• Insurance basics: public liability, professional indemnity, income protection (not legal advice, refer to a broker).\n" +
    "• Record-keeping: 5-year ATO retention; NDIS record retention (typically 7 years post-participant-end).\n" +
    "• Safety & first-response basics (First Aid/CPR currency, DRSABCD, anaphylaxis/EpiPen, choking, seizures, when to call 000). " +
    "Give calm, evidence-based first-response steps and always tell them to call 000 for life-threatening emergencies.\n\n" +
    "Respond with STRICT JSON only, no markdown, in this shape:\n" +
    '{"answer": "<concise plain-english answer>", "codes": ["<exact code from candidates>", ...]}\n' +
    "The codes array lists any catalogue codes you recommended (empty [] for non-code compliance answers).\n\n" +
    `CANDIDATE CODES (catalogue version ${version}):\n` + itemsForPrompt(items)
  );
}

type AssistantMessage = { role: string; content: string };

export const ndisAssistant = onCall({ secrets: [OPENAI_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  const messages: AssistantMessage[] = req.data?.messages || [];
  if (!messages.length) throw new HttpsError("invalid-argument", "No messages");
  await consumeAi(uid);

  const history = messages.slice(-8);
  const transcript = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const system = buildAssistantSystem(CATALOGUE_ITEMS, CATALOGUE_VERSION);
  const prompt = `Conversation so far:\n${transcript}\n\nAnswer the latest USER message. Return STRICT JSON only.`;

  try {
    let text = (await llmComplete(system, prompt)).trim();
    if (text.startsWith("```")) {
      text = text.replace(/`/g, "");
      if (text.toLowerCase().startsWith("json")) text = text.slice(4);
    }
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    let answer = text, codeIds: string[] = [];
    if (s !== -1 && e !== -1) {
      try {
        const parsed = JSON.parse(text.slice(s, e + 1));
        answer = parsed.answer ?? text;
        codeIds = parsed.codes || [];
      } catch { /* fall back to raw text as the answer */ }
    }
    const byCode = new Map(CATALOGUE_ITEMS.map((i) => [i.code, i]));
    let suggested = codeIds.map((c) => byCode.get(c)).filter(Boolean) as any[];
    if (!suggested.length) {
      const found = answer.match(/\b\d{2}_\d{2,3}_\d{3,4}_\d_\d\b/g) || [];
      suggested = found.map((c) => byCode.get(c)).filter(Boolean) as any[];
    }
    return { answer, codes: suggested.map((i) => ({ code: i.code, name: i.name, rate: i.rate, unit: i.unit })) };
  } catch (e: any) {
    throw new HttpsError("internal", `Assistant failed: ${e?.message || "unknown error"}`);
  }
});

// ---------- In-app help chatbot ----------
const APP_HELP_KNOWLEDGE = `
This app is an all-in-one business manager for NDIS disability support workers in Australia.

MAIN TABS (bottom bar): Dashboard (home), Clients, Planner, Invoices, Scan (receipt scanner).
TOOLS (open from the Dashboard/Account tiles): Business Profile, Membership, Expenses, Certs & Insurance,
Reports & BAS, Templates, NDIS Support Codes, Code Assistant, Shifts, Bank Reconcile, Language, Learn, Security (2FA).

CREATE AN INVOICE: Invoices tab -> tap the + (New Invoice). Enter the participant details (or tap "Link an existing client"),
add line items (tap "Select NDIS support item" to pick a code + rate, or dictate the description), set Issue date and Due date.
Footer has three buttons: Delete (discard), Save (stores it as a draft), and Send now (marks it sent and shares the PDF).

MULTI-PARTICIPANT INVOICES: On a new invoice tap "Add another participant" to bill several people at once. Each participant is a
collapsible card with its own details and line items, and the app creates a SEPARATE compliant invoice per participant when you save/send.
Use the copy icon on a line item to copy it to the other participants.

PRE-FILLED INVOICES / TEMPLATES: Two ways. (1) Templates tool -> "NDIS Tax Invoice" for a quick prefilled doc.
(2) Shifts -> select the clients for the shift -> either "Start now" or set a future date and tap "Plan shift"; the app pre-builds a
DRAFT invoice for each selected client, already filled with their details. Planned shifts can be activated on the day.

WHY WON'T MY INVOICE SEND / IS IT COMPLIANT? The invoice screen has a compliance panel. Red items must be completed before it's
NDIS-compliant: participant/client name, NDIS participant number, a billing address OR email, an issue date, a due date, and at least
one line item that has both a description and a rate. Complete the red checks and it will send.

MARK AN INVOICE PAID: Open the invoice -> tap "Paid". Or use Bank Reconcile to mark it paid automatically from a deposit.

BANK RECONCILE: Reports & BAS -> "Bank Reconcile". Paste or pick your bank statement CSV; the app auto-matches deposits to
outstanding invoices by amount (and invoice number in the description). Select/unselect rows for privacy, then reconcile to mark
matched invoices Paid. No bank login or credentials are stored. Paid invoices flow straight into the Reports/BAS figures.

EXPENSES & RECEIPTS: Scan tab photographs a receipt and reads the details. Expenses tool has three views: Receipts (with a GST
subtotal), Bills & Costs (recurring costs, direct debits, renewals), and a Calendar with weekly/monthly/to-date spend subtotals.

REPORTS & BAS: shows live Income, Expenses, Net position and a GST summary (1A collected / 1B credits / net GST) for the financial year,
computed from paid invoices and logged receipts. It updates as you mark things paid. You can export invoices/receipts to Excel here.

CLIENTS: Clients tab -> + to add a participant (name, NDIS number, plan manager, plan budget, care profile). Open a client to see
their budget tracker, notes, reminders, documents, linked tasks and invoices.

BUSINESS PROFILE / BRANDING: Business Profile tool -> add your logo, accent colour, invoice style, ABN, bank details and structured
business address. These appear on your invoices automatically.

NDIS CODES & CODE ASSISTANT: NDIS Support Codes tool is a searchable price-guide dictionary. The Code Assistant chats to help you pick
the right support item code for what you did (you can dictate with the mic).

SECURITY: Account -> Security to set up 2-factor authentication (2FA). LANGUAGE: Account -> Language (or the globe on the login screen) to
switch between 9 languages. MEMBERSHIP: manage your subscription in the Membership tool.
`;

export const appHelp = onCall({ secrets: [OPENAI_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  const messages: AssistantMessage[] = req.data?.messages || [];
  if (!messages.length) throw new HttpsError("invalid-argument", "No messages");
  await consumeAi(uid);

  const history = messages.slice(-8);
  const transcript = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const system =
    "You are the friendly in-app Help guide for this NDIS support-worker app. Answer ONLY questions about how to " +
    "navigate and use THIS app, based strictly on the APP GUIDE below. " +
    "Give short, plain-English, step-by-step answers (use numbered steps and the exact button/screen names). " +
    "If a question is about NDIS codes specifically, point them to the Code Assistant. " +
    "If something isn't covered by the guide, say you're not sure and suggest where in the app they might look — " +
    "never invent features that aren't in the guide. Do not give financial, legal or clinical advice.\n\n" +
    "APP GUIDE:\n" + APP_HELP_KNOWLEDGE;
  const prompt = `Conversation so far:\n${transcript}\n\nAnswer the latest USER message helpfully and concisely.`;

  try {
    const answer = (await llmComplete(system, prompt)).trim();
    return { answer };
  } catch (e: any) {
    throw new HttpsError("internal", `Help failed: ${e?.message || "unknown error"}`);
  }
});
