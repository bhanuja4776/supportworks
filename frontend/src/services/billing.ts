// Firestore-backed replacement for the /billing/* REST endpoints
// (server.py:3558-3723) EXCEPT checkout/status, which need a real Stripe
// secret key server-side and are implemented as Cloud Functions
// (functions/src/billing.ts) instead — see that file for why. Plan
// catalogue, membership status/limits, and cancellation have zero Stripe
// dependency and are pure Firestore reads/writes, migrated here directly.
import { collection, doc, getDoc, getDocs, setDoc, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/src/firebase/config";

function requireUid(): string {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u.uid;
}

// Plans & prices are defined here, not trusted from any client input when
// actually charging (server.py's own comment: "never trust client
// amounts") — the Cloud Function re-derives the amount from this same
// plan id, it never accepts a price from the caller.
export const PLANS = {
  pro_monthly: { name: "Pro Monthly", amount: 19.99, currency: "aud", period_days: 30, interval: "month" },
  pro_yearly: { name: "Pro Yearly", amount: 199.0, currency: "aud", period_days: 365, interval: "year" },
} as const;
export const TRIAL_DAYS = 14;

const FREE_LIMITS = { clients: 2, invoices_per_month: 3, ai_per_month: 10 };

function toIso(v: any): string | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return String(v);
}

function membershipOut(u: Record<string, any>): Record<string, any> {
  const expIso = toIso(u.membership_expires_at);
  const active = expIso ? new Date(expIso).getTime() > Date.now() : false;
  return {
    plan: u.plan ?? null, status: u.membership_status || "none",
    expires_at: expIso, is_active: active, auto_renew: !!u.auto_renew,
  };
}

function isPro(u: Record<string, any>): boolean {
  const expIso = toIso(u.membership_expires_at);
  return !!expIso && new Date(expIso).getTime() > Date.now();
}

export async function billingPlans(): Promise<{ trial_days: number; plans: any[] }> {
  return { trial_days: TRIAL_DAYS, plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })) };
}

export async function billingMembership(): Promise<Record<string, any>> {
  const fbUser = requireCurrentUser();
  const ref = doc(db, "users", fbUser.uid);
  const snap = await getDoc(ref);
  const u = snap.exists() ? snap.data() : {};
  return membershipOut(u);
}

function requireCurrentUser() {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

function monthPrefix(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function billingLimits(): Promise<Record<string, any>> {
  const uid = requireUid();
  const userSnap = await getDoc(doc(db, "users", uid));
  const u = userSnap.exists() ? userSnap.data() : {};
  const pro = isPro(u);

  const [clientsSnap, invoicesSnap, aiSnap] = await Promise.all([
    getDocs(query(collection(db, "clients"), where("ownerId", "==", uid))),
    getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid))),
    getDoc(doc(db, "users", uid, "aiUsage", monthPrefix())),
  ]);
  const prefix = monthPrefix();
  const invoicesThisMonth = invoicesSnap.docs.filter((d) => {
    const created = toIso(d.data().created_at) || "";
    return created.slice(0, 7) === prefix;
  }).length;

  return {
    tier: pro ? "pro" : "free",
    limits: pro ? null : FREE_LIMITS,
    usage: {
      clients: clientsSnap.size,
      invoices_this_month: invoicesThisMonth,
      ai_this_month: aiSnap.exists() ? Number(aiSnap.data().count) || 0 : 0,
    },
  };
}

export async function billingCancel(): Promise<Record<string, any>> {
  const uid = requireUid();
  const ref = doc(db, "users", uid);
  await setDoc(ref, { membership_status: "canceled", auto_renew: false }, { merge: true });
  const snap = await getDoc(ref);
  return membershipOut(snap.data() || {});
}

// Genuinely needs a server-side Stripe secret key — see functions/src/billing.ts.
export async function billingCheckout(plan: string, origin_url: string): Promise<{ url: string; session_id: string }> {
  const call = httpsCallable(functions, "createCheckoutSession");
  const res = await call({ plan, origin_url });
  return res.data as any;
}

export async function billingStatus(session_id: string): Promise<Record<string, any>> {
  const call = httpsCallable(functions, "getCheckoutStatus");
  const res = await call({ session_id });
  return res.data as any;
}
