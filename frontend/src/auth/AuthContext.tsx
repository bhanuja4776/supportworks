import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  watchAuthState, signUpEmail, signInEmail, signInGoogle, signOutUser,
  requestPasswordReset, updateDisplayName, currentFirebaseUser, type FirebaseUser,
} from "@/src/firebase/auth";
import { db, withCreateTimestamps } from "@/src/firebase/firestore";
import { PRIVACY_POLICY_VERSION } from "@/src/data/privacyPolicy";

const ONBOARD_KEY = "ndis_onboarded";
const onboardKeyFor = (uid: string) => `ndis_onboarded:${uid}`;

type Profile = {
  uid: string; email: string; name: string; picture?: string;
  privacyAccepted?: boolean; privacyAcceptedVersion?: string; privacyAcceptedAt?: string;
};

type AuthState = {
  loading: boolean;
  user: Profile | null;
  registerEmail: (email: string, password: string, name: string) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  forgot: (email: string) => Promise<void>;
  updateProfile: (body: { name?: string; picture?: string }) => Promise<void>;
  needsOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  restartOnboarding: () => Promise<void>;
  needsConsent: boolean;
  acceptPrivacy: () => Promise<void>;
};

const Ctx = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(Ctx);

// Reads the users/{uid} Firestore profile doc, creating it (merge-write, so
// this is safe to call more than once for the same sign-in — see the
// finishAuth/listener double-call note below) the first time this uid is
// seen. nameOverride wins over whatever's already stored, so an explicit
// registration name isn't clobbered by a still-empty fbUser.displayName.
async function ensureProfileDoc(fbUser: FirebaseUser, nameOverride?: string): Promise<Profile> {
  const ref = doc(db, "users", fbUser.uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data() as any) : null;
  const name = nameOverride || existing?.name || fbUser.displayName || "";
  const picture = existing?.picture || fbUser.photoURL || "";
  const privacyAcceptedVersion: string | undefined = existing?.privacyAcceptedVersion;
  const privacyAccepted = !!existing?.privacyAccepted && privacyAcceptedVersion === PRIVACY_POLICY_VERSION;
  const privacyAcceptedAt: string | undefined = existing?.privacyAcceptedAt?.toDate?.().toISOString?.();
  if (!snap.exists()) {
    await setDoc(ref, withCreateTimestamps({ email: fbUser.email || "", name, picture, privacyAccepted: false }));
  } else if (nameOverride && nameOverride !== existing?.name) {
    await setDoc(ref, { name: nameOverride }, { merge: true });
  }
  return { uid: fbUser.uid, email: fbUser.email || "", name, picture, privacyAccepted, privacyAcceptedVersion, privacyAcceptedAt };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Profile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const loadOnboardFlag = useCallback(async (uid: string) => {
    try {
      const seen = (await AsyncStorage.getItem(onboardKeyFor(uid))) || (await AsyncStorage.getItem(ONBOARD_KEY));
      setNeedsOnboarding(!seen);
    } catch { setNeedsOnboarding(false); }
  }, []);

  const finishAuth = useCallback(async (fbUser: FirebaseUser, nameOverride?: string) => {
    const profile = await ensureProfileDoc(fbUser, nameOverride);
    setUser(profile);
    setNeedsConsent(!profile.privacyAccepted);
    await loadOnboardFlag(fbUser.uid);
  }, [loadOnboardFlag]);

  // Single source of truth for session state: fires on cold-start restore,
  // sign-in, and sign-out. Also fires right after registerEmail/loginEmail/
  // loginGoogle below (those call finishAuth explicitly too) — the extra
  // call is a harmless, idempotent merge-write, not a correctness issue.
  useEffect(() => {
    const unsub = watchAuthState(async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setNeedsConsent(false);
        setLoading(false);
        return;
      }
      try { await finishAuth(fbUser); }
      catch { setUser(null); }
      finally { setLoading(false); }
    });
    return unsub;
  }, [finishAuth]);

  const registerEmail = useCallback(async (email: string, password: string, name: string) => {
    const fbUser = await signUpEmail(email, password, name);
    await finishAuth(fbUser, name);
    setNeedsOnboarding(true); // new users see the feature walkthrough
  }, [finishAuth]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const fbUser = await signInEmail(email, password);
    await finishAuth(fbUser);
  }, [finishAuth]);

  const loginGoogle = useCallback(async () => {
    const fbUser = await signInGoogle();
    await finishAuth(fbUser);
  }, [finishAuth]);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setNeedsConsent(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const fbUser = currentFirebaseUser();
    if (!fbUser) return;
    const profile = await ensureProfileDoc(fbUser);
    setUser(profile);
  }, []);

  const forgot = useCallback((email: string) => requestPasswordReset(email), []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARD_KEY, "1");
      if (user) await AsyncStorage.setItem(onboardKeyFor(user.uid), "1");
    } catch {}
    setNeedsOnboarding(false);
  }, [user]);

  const restartOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARD_KEY);
      if (user) await AsyncStorage.removeItem(onboardKeyFor(user.uid));
    } catch {}
    setNeedsOnboarding(true);
  }, [user]);

  const acceptPrivacy = useCallback(async () => {
    const fbUser = currentFirebaseUser();
    if (!fbUser) return;
    await setDoc(doc(db, "users", fbUser.uid), {
      privacyAccepted: true,
      privacyAcceptedVersion: PRIVACY_POLICY_VERSION,
      privacyAcceptedAt: serverTimestamp(),
    }, { merge: true });
    setNeedsConsent(false);
    await refreshUser();
  }, [refreshUser]);

  const updateProfile = useCallback(async (body: { name?: string; picture?: string }) => {
    const fbUser = currentFirebaseUser();
    if (!fbUser) throw new Error("Not signed in");
    const patch: Record<string, string> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.picture !== undefined) patch.picture = body.picture;
    await setDoc(doc(db, "users", fbUser.uid), patch, { merge: true });
    if (body.name) await updateDisplayName(body.name);
    await refreshUser();
  }, [refreshUser]);

  return (
    <Ctx.Provider value={{
      loading, user, registerEmail, loginEmail, loginGoogle, logout, refreshUser, forgot,
      updateProfile, needsOnboarding, completeOnboarding, restartOnboarding, needsConsent, acceptPrivacy,
    }}>
      {children}
    </Ctx.Provider>
  );
}
