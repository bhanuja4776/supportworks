// Shared free-tier gating, ported from server.py:407-458 (_is_pro,
// _enforce_invoice_limit, _consume_ai). Firestore is the source of truth
// (Admin SDK, bypasses client rules) instead of Mongo — same limits, same
// behaviour: an active/trialing/lifetime membership (membership_expires_at
// in the future) unlocks Pro, otherwise free-tier caps apply.
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";

export const FREE_LIMITS = { clients: 2, invoices_per_month: 3, ai_per_month: 10 };

export function monthPrefix(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function isPro(uid: string): Promise<boolean> {
  const snap = await db.doc(`users/${uid}`).get();
  const exp = snap.data()?.membership_expires_at;
  if (!exp) return false;
  const expMs = typeof exp.toDate === "function" ? exp.toDate().getTime() : new Date(exp).getTime();
  return expMs > Date.now();
}

// Throws UPGRADE_REQUIRED (matching the original's 402 detail string
// format) and increments the month's AI-call counter, exactly like
// _consume_ai's check-then-increment (both happen before the LLM call).
export async function consumeAi(uid: string): Promise<void> {
  const pro = await isPro(uid);
  const ref = db.doc(`users/${uid}/aiUsage/${monthPrefix()}`);
  if (!pro) {
    const snap = await ref.get();
    const count = Number(snap.data()?.count) || 0;
    if (count >= FREE_LIMITS.ai_per_month) {
      throw new HttpsError("resource-exhausted", `UPGRADE_REQUIRED:ai:${FREE_LIMITS.ai_per_month}`);
    }
  }
  await ref.set({ count: FieldValue.increment(1) }, { merge: true });
}
