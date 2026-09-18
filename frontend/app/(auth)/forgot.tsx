import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Platform, ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/AuthContext";
import { verifyResetCode, confirmReset } from "@/src/firebase/auth";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function Forgot() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { forgot } = useAuth();
  // Firebase's password-reset email links back here as
  // ?mode=resetPassword&oobCode=... — verify it and skip straight to the
  // "new password" step, same UX as the old ?token= deep link.
  const params = useLocalSearchParams<{ oobCode?: string; mode?: string }>();
  const linkCode = typeof params.oobCode === "string" ? params.oobCode : "";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"request" | "verifying" | "reset">(linkCode ? "verifying" : "request");
  const [fromLink] = useState(!!linkCode);
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!linkCode) return;
    setStage("verifying");
    verifyResetCode(linkCode)
      .then((acctEmail) => { setResetEmail(acctEmail); setStage("reset"); })
      .catch((e) => { setError(readErr(e) || t("forgot.invalidLink")); setStage("request"); });
  }, [linkCode]);

  const request = async () => {
    setError(""); setMsg("");
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) { setError(t("forgot.invalidEmail")); return; }
    setBusy(true);
    try {
      await forgot(trimmed);
      setMsg(t("forgot.sentMsg"));
    } catch (e: any) {
      setError(isNetworkErr(e) ? t("forgot.networkError") : readErr(e) || t("forgot.sendFailed"));
    }
    finally { setBusy(false); }
  };

  const reset = async () => {
    setError("");
    if (password.length < 6) { setError(t("register.pwTooShort")); return; }
    setBusy(true);
    try {
      await confirmReset(linkCode, password);
      setMsg(t("forgot.updated"));
      setTimeout(() => router.replace("/(auth)/login"), 900);
    } catch (e: any) {
      setError(isNetworkErr(e) ? t("forgot.networkError") : readErr(e));
    }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.xl }} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>{t("forgot.title")}</Text>
          <Text style={styles.subtitle}>
            {stage === "request" ? t("forgot.subReq")
              : stage === "verifying" ? t("forgot.verifying")
              : fromLink ? t("forgot.subResetFromLink") : t("forgot.subReset")}
          </Text>

          {stage === "request" && (
            <>
              <Text style={styles.label}>{t("auth.email")}</Text>
              <TextInput testID="forgot-email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={request} />
              {!!msg && <Text style={styles.msg} testID="forgot-success">{msg}</Text>}
              {!!error && <Text style={styles.error} testID="forgot-error">{error}</Text>}
              <Pressable testID="forgot-submit" style={[styles.primaryBtn, busy && { opacity: 0.7 }]} onPress={request} disabled={busy}>
                {busy ? (
                  <View style={styles.busyRow}><ActivityIndicator color={colors.onBrand} /><Text style={styles.primaryText}>{t("forgot.sending")}</Text></View>
                ) : <Text style={styles.primaryText}>{t("forgot.send")}</Text>}
              </Pressable>
            </>
          )}

          {stage === "verifying" && (
            <View style={styles.busyRow}><ActivityIndicator color={colors.brand} /></View>
          )}

          {stage === "reset" && (
            <>
              {!!msg && <Text style={styles.msg} testID="forgot-success">{msg}</Text>}
              {!!resetEmail && <Text style={styles.subtitle}>{resetEmail}</Text>}
              <Text style={styles.label}>{t("forgot.newPassword")}</Text>
              <TextInput testID="reset-password" value={password} onChangeText={setPassword} placeholder={t("register.pwPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} secureTextEntry autoCapitalize="none" />
              {!!error && <Text style={styles.error} testID="reset-error">{error}</Text>}
              <Pressable testID="reset-submit" style={[styles.primaryBtn, busy && { opacity: 0.7 }]} onPress={reset} disabled={busy}>
                {busy ? (
                  <View style={styles.busyRow}><ActivityIndicator color={colors.onBrand} /><Text style={styles.primaryText}>{t("forgot.updating")}</Text></View>
                ) : <Text style={styles.primaryText}>{t("forgot.update")}</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function isNetworkErr(e: any) {
  const m = String(e?.message || e || "");
  return /network|fetch|timeout|abort/i.test(m);
}

function readErr(e: any) {
  const code = String(e?.code || "");
  if (code) return code.replace("auth/", "").replace(/-/g, " ");
  return String(e?.message || "") || "Something went wrong";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center", marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: weight.heavy },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.xl },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  msg: { color: colors.info, fontSize: 13, marginBottom: spacing.md },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 16 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
