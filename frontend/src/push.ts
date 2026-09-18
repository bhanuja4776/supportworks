import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/src/firebase/config";

// Registers this device for push. Call on every app open (native only).
// Proxies to a third-party push provider via a Cloud Function
// (functions/src/push.ts) — the caller's uid comes from their verified
// Firebase ID token, not a client-supplied value.
export async function registerForPush() {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await httpsCallable(functions, "registerPush")({ platform: Platform.OS, device_token: tokenResp.data });
  } catch {
    // Non-blocking: push registration failures never break the app.
  }
}
