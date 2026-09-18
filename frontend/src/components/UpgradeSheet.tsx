import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { onUpgradeRequired } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";

// Global friendly upgrade prompt — shown whenever the backend answers 402
// (free-tier limit reached). Mounted once in the root layout.
export function UpgradeSheet() {
  const router = useRouter();
  const { t } = useTranslation();
  const [info, setInfo] = useState<{ feature: string; limit: number } | null>(null);

  useEffect(() => {
    onUpgradeRequired(setInfo);
    return () => onUpgradeRequired(null);
  }, []);

  if (!info) return null;

  const msg =
    info.feature === "clients" ? t("upgrade.clientsMsg", { limit: info.limit })
    : info.feature === "invoices" ? t("upgrade.invoicesMsg", { limit: info.limit })
    : t("upgrade.aiMsg", { limit: info.limit });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setInfo(null)}>
      <View style={styles.wrap}>
        <View style={styles.card} testID="upgrade-sheet">
          <View style={styles.icon}><Ionicons name="diamond" size={26} color={colors.brand} /></View>
          <Text style={styles.title}>{t("upgrade.title")}</Text>
          <Text style={styles.msg}>{msg}</Text>
          <Pressable testID="upgrade-view-plans" style={styles.primary} onPress={() => { setInfo(null); router.push("/membership" as any); }}>
            <Text style={styles.primaryText}>{t("upgrade.viewPlans")}</Text>
          </Pressable>
          <Pressable testID="upgrade-not-now" style={styles.secondary} onPress={() => setInfo(null)}>
            <Text style={styles.secondaryText}>{t("upgrade.notNow")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand + "55", padding: spacing.xl, alignItems: "center" },
  icon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.brand + "22", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy, textAlign: "center" },
  msg: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: spacing.sm },
  primary: { height: 50, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", alignSelf: "stretch", marginTop: spacing.lg },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  secondary: { padding: spacing.md, alignItems: "center" },
  secondaryText: { color: colors.muted, fontWeight: weight.bold },
});
