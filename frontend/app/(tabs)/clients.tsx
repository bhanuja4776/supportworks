import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { ClientAvatar } from "@/src/components/ClientAvatar";
import { ClientFormSheet, ageFromDob } from "@/src/components/ClientFormSheet";

// Best-effort suburb extraction from a single-line legacy address string.
// Australian conventions: "12 Somewhere St, Suburb VIC 3011" — pick the token
// between the last comma and the state/postcode.
function _suburbFromAddress(addr?: string): string {
  if (!addr) return "";
  const s = String(addr).trim();
  const lastComma = s.lastIndexOf(",");
  if (lastComma > -1) {
    // Strip trailing " VIC 3011" or similar so only the suburb remains.
    return s.slice(lastComma + 1).trim().replace(/\s+(?:VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\b.*$/i, "").trim();
  }
  return s.replace(/\s+(?:VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\b.*$/i, "").trim();
}

export default function Clients() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    try { setClients(await api.listClients()); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => { setEditing(null); setFormVisible(true); };
  const openEdit = (c: any) => { setEditing(c); setFormVisible(true); };

  const confirmDelete = (c: any) => {
    Alert.alert(t("clients.deleteTitle"), t("clients.deleteMsg", { name: c.name }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: async () => { await api.deleteClient(c.id); load(); } },
    ]);
  };

  const openActions = (c: any) => {
    Alert.alert(c.name, undefined, [
      { text: t("clients.openProfile"), onPress: () => router.push(`/client/${c.id}`) },
      { text: t("common.edit"), onPress: () => openEdit(c) },
      { text: t("common.delete"), style: "destructive", onPress: () => confirmDelete(c) },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={styles.container} testID="clients-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{t("clients.title")}</Text>
            <Text style={styles.subtitle}>{t("clients.participants", { count: clients.length })}</Text>
          </View>
          <Pressable testID="add-client-btn" style={styles.addBtn} onPress={openNew}>
            <Ionicons name="person-add" size={20} color={colors.onBrand} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="client-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t("clients.searchPlaceholder")}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>{t("clients.empty")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            // Client list subtitle intentionally only exposes NON-sensitive, general
            // identifiers: NDIS number, age and suburb (SEC/privacy — never leak
            // diagnoses, behaviours or condition text on the list card).
            const age = ageFromDob(item.date_of_birth);
            const suburb = String(item.address_suburb || "").trim() || _suburbFromAddress(item.address);
            const parts = [
              item.ndis_number ? `NDIS ${item.ndis_number}` : "",
              age,
              suburb,
            ].filter(Boolean);
            const sub = parts.join(" · ") || t("clients.noNdis");
            return (
              <Pressable
                testID={`client-${item.id}`}
                style={styles.card}
                onPress={() => router.push(`/client/${item.id}`)}
                onLongPress={() => openActions(item)}
              >
                <ClientAvatar name={item.name} color={item.color} icon={item.icon} photo={item.photo_base64} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{sub}</Text>
                </View>
                <Pressable testID={`client-menu-${item.id}`} hitSlop={10} onPress={() => openActions(item)} style={styles.menuBtn}>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <ClientFormSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSaved={load}
        initial={editing}
        defaultColorIndex={clients.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: weight.heavy },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  addBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15, paddingVertical: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  menuBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: 14 },
});
