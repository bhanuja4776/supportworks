// Thin wrapper around the Firebase Auth SDK — no React, no app-specific
// state. src/auth/AuthContext.tsx builds the app's session state on top of
// this; screens should generally go through useAuth(), not this file
// directly (the one exception is the password-reset link flow in
// (auth)/forgot.tsx, which needs verifyResetCode/confirmReset before a
// session exists at all).
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updateProfile as updateFirebaseProfile,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "./config";

export type { FirebaseUser };

export function watchAuthState(cb: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(firebaseAuth, cb);
}

export function currentFirebaseUser() {
  return firebaseAuth.currentUser;
}

export async function signUpEmail(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (name) await updateFirebaseProfile(cred.user, { displayName: name });
  return cred.user;
}

export async function signInEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function signInGoogle() {
  const cred = await signInWithPopup(firebaseAuth, googleProvider);
  return cred.user;
}

export async function signOutUser() {
  await signOut(firebaseAuth);
}

// Sends Firebase's own reset email. When opened on web this lands back on
// our /forgot page with ?mode=resetPassword&oobCode=... appended — see
// verifyResetCode/confirmReset below.
export async function requestPasswordReset(email: string) {
  const continueUrl = typeof window !== "undefined" ? `${window.location.origin}/forgot` : undefined;
  await sendPasswordResetEmail(
    firebaseAuth,
    email,
    continueUrl ? { url: continueUrl, handleCodeInApp: true } : undefined
  );
}

// Resolves to the account's email if the code is valid; throws otherwise
// (expired/used/malformed link).
export async function verifyResetCode(oobCode: string) {
  return verifyPasswordResetCode(firebaseAuth, oobCode);
}

export async function confirmReset(oobCode: string, newPassword: string) {
  await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
}

export async function updateDisplayName(name: string) {
  if (!firebaseAuth.currentUser) throw new Error("Not signed in");
  await updateFirebaseProfile(firebaseAuth.currentUser, { displayName: name });
}
