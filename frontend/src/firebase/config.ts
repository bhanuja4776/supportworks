// Single Firebase app instance, shared by every src/firebase/* module and
// every src/services/* module. Values come from EXPO_PUBLIC_* env vars set
// at build time (see docker-compose.yml / .env) — Firebase web config is
// client-side by nature; real security comes from Firestore/Storage rules,
// not from hiding these values.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 points every service at the local
// Firebase Emulator Suite (see firebase.json / DEPLOY.md) instead of a real
// project — used for local dev and the security-rules test pass, no real
// Firebase project or credentials needed. The apiKey/projectId below can be
// any placeholder value in that mode.
const useEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || (useEmulator ? "demo-api-key" : undefined),
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (useEmulator ? "demo-ndis-command-center.firebaseapp.com" : undefined),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || (useEmulator ? "demo-ndis-command-center" : undefined),
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (useEmulator ? "demo-ndis-command-center.appspot.com" : undefined),
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || (useEmulator ? "demo-app-id" : undefined),
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp);

if (useEmulator) {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
