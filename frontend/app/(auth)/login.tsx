import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Platform, ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/auth/AuthContext";
import { useTranslation } from "react-i18next";
import { LanguagePickerModal } from "@/src/components/LanguagePickerModal";
import { colors, radius, spacing, weight } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { loginEmail, loginGoogle } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gbusy, setGbusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError(""); setBusy(true);
    try { await loginEmail(email.trim(), password); }
    catch (e: any) { setError(readErr(e)); }
    finally { setBusy(false); }
  };

  const google = async () => {
    setError(""); setGbusy(true);
    try { await loginGoogle(); }
    catch (e: any) {
      // Closing the Google popup / cancelling the OAuth broker isn't an
      // error worth surfacing — the user just changed their mind.
      const code = String(e?.code || "");
      const cancelled = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
      if (!cancelled) {
        setError(code === "auth/popup-blocked" ? t("auth.googlePopupBlocked") : readErr(e));
      }
    }
    finally { setGbusy(false); }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2A33", colors.surface, colors.surface]} style={StyleSheet.absoluteFill} />
      <Pressable
        testID="login-language-btn"
        onPress={() => setLangOpen(true)}
        style={[styles.langBtn, { top: insets.top + spacing.sm }]}
        hitSlop={10}
      >
        <Ionicons name="globe-outline" size={18} color={colors.onSurface} />
        <Text style={styles.langBtnText}>{t("language.title")}</Text>
      </Pressable>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.xxxl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="pulse" size={30} color={colors.onBrand} />
          </View>
          <Text style={styles.eyebrow}>{t("auth.eyebrow")}</Text>
          <Text style={styles.title}>{t("auth.welcomeBack")}</Text>
          <Text style={styles.subtitle}>{t("auth.signInSubtitle")}</Text>

          <Pressable testID="google-login-btn" style={styles.googleBtn} onPress={google} disabled={gbusy}>
            {gbusy ? <ActivityIndicator color={colors.onSurface} /> : (
              <>
                <Ionicons name="logo-google" size={18} color="#EA4335" />
                <Text style={styles.googleText}>{t("auth.continueGoogle")}</Text>
              </>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} /><Text style={styles.divText}>{t("auth.or")}</Text><View style={styles.line} />
          </View>

          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput testID="login-email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Text style={styles.label}>{t("auth.password")}</Text>
          <View style={styles.pwWrap}>
            <TextInput testID="login-password" value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.muted} style={styles.pwInput} secureTextEntry={!show} autoCapitalize="none" />
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
              <Ionicons name={show ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/(auth)/forgot")} style={styles.forgotLink}>
            <Text style={styles.forgotText}>{t("auth.forgotPassword")}</Text>
          </Pressable>

          {!!error && <Text style={styles.error} testID="login-error">{error}</Text>}

          <Pressable testID="login-submit" style={styles.primaryBtn} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("auth.signIn")}</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("auth.newHere")}</Text>
            <Pressable testID="go-register" onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.footerLink}>{t("auth.createAccount")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <LanguagePickerModal visible={langOpen} onClose={() => setLangOpen(false)} />
    </View>
  );
}

function readErr(e: any) {
  const m = String(e?.message || "");
  try { return JSON.parse(m).detail || m; } catch { return m || "Something went wrong"; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  langBtn: { position: "absolute", right: spacing.lg, zIndex: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceSecondary + "CC", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  langBtnText: { color: colors.onSurface, fontSize: 12, fontWeight: weight.bold },
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, letterSpacing: 2 },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: weight.heavy, marginTop: spacing.xs },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.xl },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 54, borderRadius: radius.md, backgroundColor: colors.onSurface },
  googleText: { color: "#1A1A1A", fontWeight: weight.heavy, fontSize: 15 },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.divider },
  divText: { color: colors.muted, fontSize: 13 },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  pwWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  pwInput: { flex: 1, paddingVertical: spacing.md, color: colors.onSurface, fontSize: 15 },
  forgotLink: { alignSelf: "flex-end", paddingVertical: spacing.sm },
  forgotText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: colors.brand, fontSize: 14, fontWeight: weight.bold },
});
