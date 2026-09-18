// Firestore-backed replacement for the /settings REST endpoints. A
// necessary dependency of Invoices, not a separate milestone — every
// invoice snapshots the business profile at creation time (name, ABN, bank
// details, logo, invoice theme/style), and the PDF/preview reads the same
// fields. Singleton doc per owner, keyed by uid (same pattern as
// clients/{clientId} but doc ID == uid, matching the old Mongo
// "business::{org}" singleton).
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";

function requireUid(): string {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u.uid;
}

// Matches the old backend's BUSINESS_KEYS exactly.
export const BUSINESS_KEYS = [
  "business_name", "abn", "address", "email", "phone",
  "bank_name", "account_name", "bsb", "account_number",
  "invoice_theme", "invoice_style", "logo_base64",
] as const;

export async function getSettings(): Promise<Record<string, any>> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "settings", uid));
  return snap.exists() ? (snap.data() as Record<string, any>) : {};
}

export async function putSettings(body: Record<string, any>) {
  const uid = requireUid();
  await setDoc(doc(db, "settings", uid), body, { merge: true });
  return getSettings();
}

// Snapshot of business/branding fields, embedded onto an invoice at
// creation time so historical invoices don't change if settings are later
// edited — mirrors the backend's _business_snapshot exactly.
export function businessSnapshot(settings: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of BUSINESS_KEYS) {
    if (settings[k]) out[k] = settings[k];
  }
  return out;
}
