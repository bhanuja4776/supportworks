import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";

type Item = { key: string; icon: any; url: string; color: string };

// NDIS worker-facing resources — this tile is inside the worker app so every
// link needs to point at NDIS Commission worker guidance (NOT participant guidance).
const RESOURCES: Item[] = [
  { key: "learn.categoryRights", icon: "shield-checkmark", url: "https://www.ndiscommission.gov.au/workers/worker-obligations", color: colors.brand },
  { key: "learn.categoryGettingStarted", icon: "school", url: "https://www.ndiscommission.gov.au/workers", color: colors.info },
  { key: "learn.categoryCodeOfConduct", icon: "document-text", url: "https://www.ndiscommission.gov.au/workers/ndis-code-conduct", color: colors.success },
  { key: "learn.categoryComplaints", icon: "megaphone", url: "https://www.ndiscommission.gov.au/about/complaints", color: colors.warning },
  { key: "learn.categoryLanguages", icon: "language", url: "https://www.ndis.gov.au/about-us/information-in-your-language", color: colors.brand },
];

export default function Learn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={styles.container} testID="learn-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("learn.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t("learn.subtitle")}</Text>

        <View style={styles.banner}>
          <Ionicons name="globe" size={20} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{t("learn.officialTitle")}</Text>
            <Text style={styles.bannerSub}>{t("learn.officialSub")}</Text>
          </View>
        </View>

        {RESOURCES.map((r) => (
          <Pressable key={r.key} testID={`resource-${r.key}`} style={styles.row} onPress={() => open(r.url)}>
            <View style={[styles.rowIcon, { backgroundColor: r.color + "22" }]}>
              <Ionicons name={r.icon} size={18} color={r.color} />
            </View>
            <Text style={styles.rowTitle}>{t(r.key)}</Text>
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          </Pressable>
        ))}

        <Text style={styles.disclaimer}>{t("learn.disclaimer")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.md },
  bannerTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.heavy },
  bannerSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTitle: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.lg },
});
