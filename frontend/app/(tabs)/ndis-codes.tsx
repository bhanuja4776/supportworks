import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, SectionList } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, spacing, weight } from "@/src/theme";
import { money } from "@/src/api";
import { loadCatalogue, filterItems, groupByCategory, FILTER_TAGS, NdisItem, Catalogue } from "@/src/ndis";
import { useTranslation } from "react-i18next";

export default function NdisCodes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    loadCatalogue().then(({ catalogue }) => {
      setCat(catalogue); setLoading(false);
    });
  }, []);

  const toggleTag = (tag: string) => setTags((s) => (s.includes(tag) ? s.filter((x) => x !== tag) : [...s, tag]));

  const sections = useMemo(() => {
    if (!cat) return [];
    const filtered = filterItems(cat.items, query, tags);
    return groupByCategory(filtered).map((g) => ({ title: g.category, data: g.items }));
  }, [cat, query, tags]);

  const addToInvoice = useCallback((it: NdisItem) => {
    router.push({ pathname: "/invoice/new", params: { presetCode: it.code, presetDesc: it.name, presetRate: String(it.rate) } });
  }, [router]);

  return (
    <View style={styles.container} testID="ndis-codes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("ndisCodes.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading || !cat ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <>
          <View style={styles.metaBar}>
            <View style={styles.versionPill}>
              <Ionicons name="pricetag" size={12} color={colors.brand} />
              <Text style={styles.versionText}>v{cat.version} · {cat.last_updated}</Text>
            </View>
            <View style={[styles.versionPill, { backgroundColor: colors.success + "22" }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={[styles.versionText, { color: colors.success }]}>{t("ndisCodes.upToDate")}</Text>
            </View>
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              testID="ndis-search"
              value={query}
              onChangeText={setQuery}
              placeholder={t("ndisCodes.searchPlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagRowWrap} contentContainerStyle={styles.tagRow}>
            {FILTER_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable key={tag} testID={`tag-${tag}`} onPress={() => toggleTag(tag)} style={[styles.tag, on && styles.tagOn]}>
                  <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <SectionList
            sections={sections}
            keyExtractor={(item) => item.code}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
            ListEmptyComponent={<Text style={styles.empty}>{t("ndisCodes.noMatch")}</Text>}
            ListHeaderComponent={<Text style={styles.note}>{cat.source_note}</Text>}
            renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
            renderItem={({ item }) => (
              <View style={styles.card} testID={`ndis-${item.code}`}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{item.code}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.rate}>{money(item.rate)} / {item.unit}</Text>
                  <View style={styles.chipWrap}>
                    {item.tags.slice(0, 3).map((t) => (
                      <View key={t} style={styles.miniChip}><Text style={styles.miniChipText}>{t}</Text></View>
                    ))}
                  </View>
                </View>
                <Pressable testID={`add-${item.code}`} onPress={() => addToInvoice(item)} style={styles.addBtn}>
                  <Ionicons name="add" size={20} color={colors.onBrand} />
                </Pressable>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  metaBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  versionPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  versionText: { color: colors.brand, fontSize: 11, fontWeight: weight.bold },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15, paddingVertical: spacing.md },
  tagRowWrap: { maxHeight: 52, marginTop: spacing.sm },
  tagRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  tag: { height: 34, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  tagOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tagText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.medium },
  tagTextOn: { color: colors.onBrand, fontWeight: weight.bold },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: spacing.md, fontStyle: "italic" },
  sectionHeader: { color: colors.brand, fontSize: 13, fontWeight: weight.heavy, letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  code: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  name: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold, marginTop: 2 },
  rate: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginTop: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  miniChip: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  miniChipText: { color: colors.muted, fontSize: 10, fontWeight: weight.medium },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
