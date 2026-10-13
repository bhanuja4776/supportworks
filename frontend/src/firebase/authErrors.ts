import type { TFunction } from "i18next";

// Firebase Auth error code -> i18n key (authErrors.* in the locale files).
// Wrong-password / unknown-user / invalid-credential all map to one message
// on purpose, so the sign-in form never reveals which emails have accounts.
const CODE_KEYS: Record<string, string> = {
  "auth/invalid-email": "authErrors.invalidEmail",
  "auth/missing-email": "authErrors.invalidEmail",
  "auth/missing-password": "authErrors.missingPassword",
  "auth/invalid-credential": "authErrors.badCredentials",
  "auth/invalid-login-credentials": "authErrors.badCredentials",
  "auth/wrong-password": "authErrors.badCredentials",
  "auth/user-not-found": "authErrors.badCredentials",
  "auth/email-already-in-use": "authErrors.emailInUse",
  "auth/weak-password": "authErrors.weakPassword",
  "auth/too-many-requests": "authErrors.tooManyRequests",
  "auth/network-request-failed": "authErrors.network",
  "auth/user-disabled": "authErrors.userDisabled",
  "auth/expired-action-code": "authErrors.invalidLink",
  "auth/invalid-action-code": "authErrors.invalidLink",
  "auth/popup-blocked": "auth.googlePopupBlocked",
  "auth/account-exists-with-different-credential": "authErrors.differentMethod",
  "auth/operation-not-allowed": "authErrors.methodDisabled",
  "auth/unauthorized-domain": "authErrors.domainNotAllowed",
  "auth/unauthorized-continue-uri": "authErrors.domainNotAllowed",
};

// Turns a Firebase Auth error into a short, user-facing sentence. Anything
// unmapped falls back to `fallbackKey` (or a generic message) and the raw
// error is logged for debugging instead of being shown to the user.
export function authErrorMessage(e: any, t: TFunction, fallbackKey = "authErrors.generic"): string {
  const code = String(e?.code || "");
  const fromMessage = /\((auth\/[a-z-]+)\)/.exec(String(e?.message || ""))?.[1];
  const key = CODE_KEYS[code] || (fromMessage ? CODE_KEYS[fromMessage] : undefined);
  if (key) return t(key);
  console.warn("[auth] unmapped error:", code || e?.message || e);
  return t(fallbackKey);
}
