import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage, LangCode } from "@/src/i18n";
import { colors, radius, spacing, weight } from "@/src/theme";

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const current = i18n.language as LangCode;

  const choose = async (code: LangCode) => {
    Haptics.selectionAsync();
    await setLanguage(code);
  };

  return (
    <View style={styles.container} testID="language-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("language.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t("language.subtitle")}</Text>
        {LANGUAGES.map((l) => {
          const active = l.code === current;
          return (
            <Pressable
              key={l.code}
              testID={`lang-${l.code}`}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => choose(l.code)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.native, active && { color: colors.brand }]}>{l.native}</Text>
                <View style={styles.subRow}>
                  <Text style={styles.label}>{l.label}</Text>
                  {l.community && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{t("language.communityNote")}</Text>
                    </View>
                  )}
                </View>
              </View>
              {active
                ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                : <Ionicons name="ellipse-outline" size={22} color={colors.borderStrong} />}
            </Pressable>
          );
        })}
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  native: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  label: { color: colors.muted, fontSize: 13 },
  pill: { backgroundColor: colors.info + "22", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { color: colors.info, fontSize: 10, fontWeight: weight.bold },
});
