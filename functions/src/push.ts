// Cloud Function replacement for POST /register-push (server.py:2973-2997).
// Not a MongoDB dependency at all — the original endpoint never touched
// Mongo, it's a thin authenticated proxy to a third-party push provider
// ("Emergent", a vendor tied to this app's original hosting platform, not
// Firebase Cloud Messaging). It's ported here anyway so the frontend has
// zero remaining calls to the old backend once this deploys — see
// src/push.ts, now the last file that still referenced
// EXPO_PUBLIC_BACKEND_URL. EMERGENT_PUSH_KEY is empty in this environment
// (confirmed via backend/.env), same "unverified against the real
// third-party API" situation as the OpenAI/Stripe functions.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const EMERGENT_PUSH_KEY = defineSecret("EMERGENT_PUSH_KEY");
const PUSH_BASE_URL = "https://integrations.emergentagent.com";

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required");
  return auth.uid;
}

export const registerPush = onCall({ secrets: [EMERGENT_PUSH_KEY] }, async (req) => {
  const uid = requireUid(req.auth);
  const key = EMERGENT_PUSH_KEY.value() || "placeholder";
  const res = await fetch(`${PUSH_BASE_URL}/api/v1/push/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Push-Key": key },
    // Defence in depth, same as the original: ignore any client-supplied
    // user_id and force it to the authenticated caller.
    body: JSON.stringify({ ...req.data, user_id: uid }),
  });
  if (res.status === 401) throw new HttpsError("failed-precondition", "EMERGENT_PUSH_KEY missing or invalid");
  if (res.status >= 500) throw new HttpsError("unavailable", "Push provider unavailable");
  return { status: "registered" };
});
