import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, money } from "@/src/api";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useCelebration } from "@/src/components/Celebration";
import { confirmAction } from "@/src/utils/confirm";

function sentAgo(iso: string): { d: number; h: number } | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const ms = Math.max(0, Date.now() - then);
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000) };
}

export default function Invoices() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const celebrate = useCelebration();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.listInvoices();
      setInvoices(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const togglePaid = async (inv: any) => {
    const next = inv.status === "paid" ? "unpaid" : "paid";
    await api.setInvoiceStatus(inv.id, next);
    if (next === "paid") celebrate(t("invoices.paidToast", { number: inv.invoice_number }), { sound: true });
    load();
  };

  const removeInvoice = (inv: any) => {
    confirmAction({
      title: t("invoices.deleteTitle"),
      message: t("invoices.deleteMsg", { number: inv.invoice_number }),
      confirmText: t("common.delete"),
      destructive: true,
      onConfirm: async () => { await api.deleteInvoice(inv.id); load(); },
    });
  };

  return (
    <View style={styles.container} testID="invoices-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.title}>{t("invoices.title")}</Text>
          <Text style={styles.subtitle}>{t("invoices.subtitle", { count: invoices.length })}</Text>
        </View>
        <Pressable testID="new-invoice-btn" style={styles.addBtn} onPress={() => router.push("/invoice/new")}>
          <Ionicons name="add" size={22} color={colors.onBrand} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>{t("invoices.empty")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const paid = item.status === "paid";
            const draft = item.status === "draft";
            const ago = sentAgo(item.sent_date);
            const unsent = !draft && !item.sent_date;
            return (
              <Pressable style={styles.card} testID={`invoice-${item.id}`} onPress={() => router.push(`/invoice/${item.id}`)}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNum}>{item.invoice_number}</Text>
                    <Text style={styles.client}>{item.client_name || t("invoices.noClient")}</Text>
                    {!draft && (
                      <View style={styles.sentRow}>
                        <Ionicons
                          name={unsent ? "alert-circle" : "paper-plane"}
                          size={12}
                          color={unsent ? colors.warning : colors.muted}
                        />
                        <Text style={[styles.sentText, unsent && { color: colors.warning, fontWeight: weight.bold }]}>
                          {unsent
                            ? t("invoices.unsent")
                            : ago && (ago.d > 0 || ago.h > 0)
                            ? t("invoices.sentAgo", { days: ago.d, hours: ago.h })
                            : t("invoices.sentJustNow")}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.pill, { backgroundColor: (draft ? colors.info : paid ? colors.success : colors.warning) + "22" }]}>
                      <Text style={[styles.pillText, { color: draft ? colors.info : paid ? colors.success : colors.warning }]}>
                        {draft ? t("invoices.draft") : paid ? t("invoices.paid") : t("invoices.unpaid")}
                      </Text>
                    </View>
                    <Pressable testID={`del-invoice-${item.id}`} onPress={() => removeInvoice(item)} hitSlop={8} style={styles.delBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.total}>{money(item.total)}</Text>
                    <Text style={styles.gst}>{t("invoices.inclGst", { amount: money(item.gst) })}</Text>
                  </View>
                  <Pressable
                    testID={`toggle-paid-${item.id}`}
                    onPress={() => togglePaid(item)}
                    style={[styles.payBtn, paid && styles.payBtnPaid]}
                  >
                    <Ionicons name={paid ? "arrow-undo" : "checkmark-done"} size={16} color={paid ? colors.muted : colors.onBrand} />
                    <Text style={[styles.payText, paid && { color: colors.muted }]}>
                      {paid ? t("invoices.markUnpaid") : t("invoices.markPaid")}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: weight.heavy },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  addBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  delBtn: { padding: spacing.xs, marginLeft: spacing.sm },
  invNum: { color: colors.brand, fontSize: 13, fontWeight: weight.bold, letterSpacing: 1 },
  client: { color: colors.onSurface, fontSize: 17, fontWeight: weight.bold, marginTop: 2 },
  sentRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  sentText: { color: colors.muted, fontSize: 12 },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: weight.heavy, letterSpacing: 0.5 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.lg },
  total: { color: colors.onSurface, fontSize: 22, fontWeight: weight.heavy },
  gst: { color: colors.muted, fontSize: 12, marginTop: 2 },
  payBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  payBtnPaid: { backgroundColor: colors.brandTertiary },
  payText: { color: colors.onBrand, fontSize: 13, fontWeight: weight.bold },
  empty: { alignItems: "center", marginTop: spacing.xxxl, gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 14 },
});
