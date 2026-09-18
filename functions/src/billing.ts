// Cloud Functions replacement for the two Stripe-dependent /billing/*
// endpoints (server.py:3636-3742: checkout session creation, status
// polling, and the webhook). Everything else billing-related (plan
// catalogue, membership read, free-tier limits, cancel) has no Stripe
// dependency and lives directly in frontend/src/services/billing.ts as
// plain Firestore reads/writes — these three functions are only the pieces
// that genuinely need a server-side Stripe secret key.
//
// IMPORTANT — unverified in this environment: STRIPE_API_KEY and
// STRIPE_WEBHOOK_SECRET are both empty in this dev environment (confirmed
// via backend/.env), so checkout already fails on the ORIGINAL Mongo
// backend today. This is a faithful migration of an already-nonfunctional
// (in this environment) flow, not a regression.
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";

const STRIPE_API_KEY = defineSecret("STRIPE_API_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// Server-side only — never trust a price the client sends.
const PLANS: Record<string, { name: string; amount: number; currency: string; period_days: number }> = {
  pro_monthly: { name: "Pro Monthly", amount: 19.99, currency: "aud", period_days: 30 },
  pro_yearly: { name: "Pro Yearly", amount: 199.0, currency: "aud", period_days: 365 },
};

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required");
  return auth.uid;
}

export const createCheckoutSession = onCall({ secrets: [STRIPE_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  const planId: string = req.data?.plan;
  const originUrl: string = (req.data?.origin_url || "").replace(/\/$/, "");
  const plan = PLANS[planId];
  if (!plan) throw new HttpsError("invalid-argument", "Unknown plan");
  const key = STRIPE_API_KEY.value();
  if (!key) throw new HttpsError("failed-precondition", "Stripe not configured");

  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: plan.currency,
        unit_amount: Math.round(plan.amount * 100),
        product_data: { name: plan.name },
      },
      quantity: 1,
    }],
    success_url: `${originUrl}/membership?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${originUrl}/membership`,
    metadata: { user_id: uid, plan: planId, source: "membership" },
  });

  await db.doc(`paymentTransactions/${session.id}`).set({
    session_id: session.id, ownerId: uid, plan: planId,
    amount: plan.amount, currency: plan.currency,
    payment_status: "initiated", status: "open", processed: false,
    created_at: FieldValue.serverTimestamp(),
  });
  return { url: session.url, session_id: session.id };
});

async function applyPaidMembership(sessionId: string): Promise<void> {
  const txRef = db.doc(`paymentTransactions/${sessionId}`);
  const txSnap = await txRef.get();
  const tx = txSnap.data();
  if (!tx || tx.processed) return;
  const plan = PLANS[tx.plan];
  if (!plan) return;

  const userRef = db.doc(`users/${tx.ownerId}`);
  const userSnap = await userRef.get();
  const cur = userSnap.data()?.membership_expires_at as Timestamp | undefined;
  const now = new Date();
  const base = cur && cur.toDate() > now ? cur.toDate() : now;
  const expires = new Date(base.getTime() + plan.period_days * 86400000);

  await userRef.set({
    plan: tx.plan, membership_status: "active",
    membership_expires_at: Timestamp.fromDate(expires), auto_renew: true,
  }, { merge: true });
  await txRef.set({ processed: true, payment_status: "paid", status: "complete", paid_at: FieldValue.serverTimestamp() }, { merge: true });
}

export const getCheckoutStatus = onCall({ secrets: [STRIPE_API_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  const sessionId: string = req.data?.session_id;
  const key = STRIPE_API_KEY.value();
  if (!key) throw new HttpsError("failed-precondition", "Stripe not configured");

  const stripe = new Stripe(key);
  const status = await stripe.checkout.sessions.retrieve(sessionId);
  if (status.payment_status === "paid") {
    await applyPaidMembership(sessionId);
  } else {
    await db.doc(`paymentTransactions/${sessionId}`).set(
      { payment_status: status.payment_status, status: status.status }, { merge: true },
    );
  }
  const userSnap = await db.doc(`users/${uid}`).get();
  const u = userSnap.data() || {};
  const exp = u.membership_expires_at as Timestamp | undefined;
  const active = !!exp && exp.toDate() > new Date();
  return {
    payment_status: status.payment_status,
    status: status.status,
    membership: {
      plan: u.plan ?? null, status: u.membership_status || "none",
      expires_at: exp ? exp.toDate().toISOString() : null,
      is_active: active, auto_renew: !!u.auto_renew,
    },
  };
});

// HTTP (not callable) — Stripe posts here directly, so this verifies the
// signature itself rather than relying on Firebase Auth.
export const stripeWebhook = onRequest({ secrets: [STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  const key = STRIPE_API_KEY.value();
  const whSecret = STRIPE_WEBHOOK_SECRET.value();
  if (!key || !whSecret) { res.status(200).json({ received: false }); return; }
  const stripe = new Stripe(key);
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, whSecret);
  } catch (e) {
    res.status(200).json({ received: false });
    return;
  }
  const obj = event.data.object as any;
  if (
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
    obj.id && obj.payment_status === "paid"
  ) {
    await applyPaidMembership(obj.id);
  }
  res.status(200).json({ received: true });
});
