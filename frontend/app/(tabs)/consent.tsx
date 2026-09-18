import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/src/auth/AuthContext";
import { PolicyContent } from "@/src/components/PolicyContent";
import { PRIVACY_POLICY_TEXT, PRIVACY_POLICY_VERSION, PRIVACY_POLICY_UPDATED } from "@/src/data/privacyPolicy";
import { confirmAction } from "@/src/utils/confirm";
import { colors, radius, spacing, weight } from "@/src/theme";

// Blocking consent screen (Australian Privacy Principles) — shown on first
// sign-in and whenever PRIVACY_POLICY_VERSION changes. Acceptance is
// recorded on the user's Firestore profile with a server timestamp.
export default function Consent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { acceptPrivacy, logout, needsOnboarding } = useAuth();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await acceptPrivacy();
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)" as any);
    } catch (e: any) {
      Alert.alert(t("common.somethingWrong"), e?.message || "");
    } finally { setBusy(false); }
  };

  const decline = () => {
    confirmAction({
      title: t("consent.decline"),
      message: t("consent.declineMsg"),
      confirmText: t("consent.decline"),
      destructive: true,
      onConfirm: logout,
    });
  };

  return (
    <View style={styles.container} testID="consent-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.shield}><Ionicons name="shield-checkmark" size={26} color={colors.brand} /></View>
        <Text style={styles.title}>{t("consent.title")}</Text>
        <Text style={styles.subtitle}>{t("consent.subtitle")}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator testID="consent-policy-scroll">
        <PolicyContent content={PRIVACY_POLICY_TEXT} />
        <Text style={styles.version}>{t("consent.versionLine", { version: PRIVACY_POLICY_VERSION, date: PRIVACY_POLICY_UPDATED })}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable testID="consent-accept" style={[styles.acceptBtn, busy && { opacity: 0.5 }]} onPress={accept} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : (
            <>
              <Ionicons name="checkmark-circle" size={18} color={colors.onBrand} />
              <Text style={styles.acceptText}>{t("consent.accept")}</Text>
            </>
          )}
        </Pressable>
        <Pressable testID="consent-decline" onPress={decline} style={{ alignItems: "center", padding: spacing.md }}>
          <Text style={styles.declineText}>{t("consent.decline")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: "center", gap: spacing.xs },
  shield: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand + "22", alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: weight.heavy, textAlign: "center" },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  scroll: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  version: { color: colors.muted, fontSize: 12, marginTop: spacing.lg, textAlign: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  acceptBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  acceptText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  declineText: { color: colors.muted, fontWeight: weight.bold, fontSize: 13 },
});
