import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Platform, ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/AuthContext";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";

export default function Register() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { registerEmail, loginGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gbusy, setGbusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (password.length < 6) { setError(t("register.pwTooShort")); return; }
    setBusy(true);
    try { await registerEmail(email.trim(), password, name.trim()); }
    catch (e: any) { setError(readErr(e)); }
    finally { setBusy(false); }
  };

  const google = async () => {
    setError(""); setGbusy(true);
    try { await loginGoogle(); }
    catch (e: any) {
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.xl }} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>{t("register.title")}</Text>
          <Text style={styles.subtitle}>{t("register.subtitle")}</Text>

          <Text style={styles.label}>{t("auth.name")}</Text>
          <TextInput testID="reg-name" value={name} onChangeText={setName} placeholder={t("register.namePlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput testID="reg-email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>{t("auth.password")}</Text>
          <View style={styles.pwWrap}>
            <TextInput testID="reg-password" value={password} onChangeText={setPassword} placeholder={t("register.pwPlaceholder")} placeholderTextColor={colors.muted} style={styles.pwInput} secureTextEntry={!show} autoCapitalize="none" />
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
              <Ionicons name={show ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </Pressable>
          </View>

          {!!error && <Text style={styles.error} testID="reg-error">{error}</Text>}

          <Pressable testID="reg-submit" style={styles.primaryBtn} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("register.create")}</Text>}
          </Pressable>

          <Pressable testID="reg-google" style={styles.googleBtn} onPress={google} disabled={gbusy}>
            {gbusy ? <ActivityIndicator color={colors.onSurface} /> : (
              <>
                <Ionicons name="logo-google" size={18} color="#EA4335" />
                <Text style={styles.googleText}>{t("register.google")}</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("auth.alreadyHave")}</Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.footerLink}>{t("auth.signInLink")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function readErr(e: any) {
  const m = String(e?.message || "");
  try { return JSON.parse(m).detail || m; } catch { return m || "Something went wrong"; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center", marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: weight.heavy },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.xl },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  pwWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  pwInput: { flex: 1, paddingVertical: spacing.md, color: colors.onSurface, fontSize: 15 },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.sm },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 16 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 54, borderRadius: radius.md, backgroundColor: colors.onSurface, marginTop: spacing.md },
  googleText: { color: "#1A1A1A", fontWeight: weight.heavy, fontSize: 15 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: colors.brand, fontSize: 14, fontWeight: weight.bold },
});
