// Cloud-Function-backed replacement for the OpenAI-calling REST endpoints
// (scan-receipt, scan-document, scan-text, ai/ndis-assistant, ai/app-help,
// transcribe). These are the one deliberate exception to "no backend" in
// this migration — the OpenAI key must stay server-side — see
// functions/src/ai.ts for the actual implementation and the honest note
// about this being unverified against the real OpenAI API in this
// environment (no key configured).
import { httpsCallable, FunctionsError } from "firebase/functions";
import { functions } from "@/src/firebase/config";
import { notifyUpgradeRequired } from "@/src/upgradeListener";

// consumeAi() (functions/src/limits.ts) throws HttpsError("resource-exhausted",
// "UPGRADE_REQUIRED:ai:10") once the free-tier monthly AI-call cap is hit —
// same signal shape as the old backend's 402, just via a callable error
// instead of an HTTP status. Surface it as the same friendly upgrade sheet.
async function call<T>(name: string, data: unknown): Promise<T> {
  try {
    const res = await httpsCallable(functions, name)(data);
    return res.data as T;
  } catch (e) {
    if (e instanceof FunctionsError && e.code === "resource-exhausted") {
      const m = /UPGRADE_REQUIRED:(\w+):(\d+)/.exec(e.message);
      if (m) {
        notifyUpgradeRequired({ feature: m[1], limit: parseInt(m[2], 10) });
        throw new Error("Free plan limit reached — upgrade to Pro to continue.");
      }
    }
    throw e;
  }
}

export const scanReceipt = (image_base64: string) => call<any>("scanReceipt", { image_base64 });
export const scanDocument = (image_base64: string) => call<any>("scanDocument", { image_base64 });
export const scanText = (image_base64: string) => call<any>("scanText", { image_base64 });
export const transcribe = (audio_base64: string, format = "m4a") => call<any>("transcribeAudio", { audio_base64, format });
export const ndisAssistant = (messages: { role: string; content: string }[]) => call<any>("ndisAssistant", { messages });
export const appHelp = (messages: { role: string; content: string }[]) => call<any>("appHelp", { messages });
