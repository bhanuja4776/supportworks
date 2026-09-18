import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/src/auth/AuthContext";
import { PolicyContent } from "@/src/components/PolicyContent";
import { PRIVACY_POLICY_TEXT, PRIVACY_POLICY_VERSION, PRIVACY_POLICY_UPDATED } from "@/src/data/privacyPolicy";
import { toDMY } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";

// Read-only view of the Privacy Policy (reachable from Account).
export default function PrivacyPolicy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <View style={styles.container} testID="privacy-policy-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("account.privacyPolicy")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {user?.privacyAccepted && !!user?.privacyAcceptedAt && (
          <View style={styles.acceptedRow} testID="consent-accepted-row">
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.acceptedText}>{t("consent.acceptedOn", { date: toDMY(user.privacyAcceptedAt) })}</Text>
          </View>
        )}
        <PolicyContent content={PRIVACY_POLICY_TEXT} />
        <Text style={styles.version}>{t("consent.versionLine", { version: PRIVACY_POLICY_VERSION, date: PRIVACY_POLICY_UPDATED })}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  acceptedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.success + "18", borderColor: colors.success + "55", borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  acceptedText: { color: colors.success, fontSize: 13, fontWeight: weight.bold },
  version: { color: colors.muted, fontSize: 12, marginTop: spacing.lg, textAlign: "center" },
});
