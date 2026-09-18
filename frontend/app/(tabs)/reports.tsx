import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, money } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useTranslation } from "react-i18next";

export default function Reports() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [fy, setFy] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");

  const load = useCallback(async (year?: number | null) => {
    setLoading(true);
    try {
      const d = await api.reportsSummary(year ?? undefined);
      setData(d);
      setFy(d.fy_start);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(fy); }, []));

  const exportFile = async (type: string) => {
    setExporting(type);
    try {
      if (type === "receipts") await api.exportReceiptsXlsx();
      else await api.exportInvoicesXlsx();
    } catch {} finally { setExporting(""); }
  };

  const maxVal = data ? Math.max(1, ...data.months.map((m: any) => Math.max(m.income, m.expenses))) : 1;

  return (
    <View style={styles.container} testID="reports-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("reports.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading || !data ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={styles.fyRow}>
            <Pressable testID="fy-prev" onPress={() => load((fy || 0) - 1)} style={styles.fyBtn}><Ionicons name="chevron-back" size={18} color={colors.brand} /></Pressable>
            <Text style={styles.fyLabel}>{t("reports.fy", { fy: data.fy })}</Text>
            <Pressable testID="fy-next" onPress={() => load((fy || 0) + 1)} style={styles.fyBtn}><Ionicons name="chevron-forward" size={18} color={colors.brand} /></Pressable>
          </View>

          <View style={styles.heroRow}>
            <View style={[styles.heroCard, { borderColor: colors.success + "55" }]}>
              <Text style={styles.heroLabel}>{t("reports.incomePaid")}</Text>
              <Text style={[styles.heroValue, { color: colors.success }]}>{money(data.income)}</Text>
            </View>
            <View style={[styles.heroCard, { borderColor: colors.error + "55" }]}>
              <Text style={styles.heroLabel}>{t("reports.expenses")}</Text>
              <Text style={[styles.heroValue, { color: colors.error }]}>{money(data.expenses)}</Text>
            </View>
          </View>
          <View style={styles.netCard}>
            <Text style={styles.heroLabel}>{t("reports.netPosition")}</Text>
            <Text style={[styles.netValue, { color: data.net >= 0 ? colors.brand : colors.warning }]}>{money(data.net)}</Text>
          </View>

          {/* Chart */}
          <Text style={styles.sectionTitle}>{t("reports.incomeVsExpenses")}</Text>
          <View style={styles.chart}>
            {data.months.map((m: any, i: number) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${(m.income / maxVal) * 100}%`, backgroundColor: colors.success }]} />
                  <View style={[styles.bar, { height: `${(m.expenses / maxVal) * 100}%`, backgroundColor: colors.error }]} />
                </View>
                <Text style={styles.barLabel}>{m.label[0]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <Legend color={colors.success} label={t("reports.income")} />
            <Legend color={colors.error} label={t("reports.expenses")} />
          </View>

          {/* BAS */}
          <Text style={styles.sectionTitle}>{t("reports.basTitle")}</Text>
          <View style={styles.basCard}>
            <BasRow label={t("reports.gstCollected")} value={money(data.gst_collected)} />
            <BasRow label={t("reports.gstCredits")} value={money(data.gst_credits)} />
            <View style={styles.divider} />
            <BasRow label={t("reports.netGst")} value={money(data.gst_payable)} strong />
          </View>

          {/* Exports */}
          <Text style={styles.sectionTitle}>{t("reports.exportTitle")}</Text>
          <View style={styles.exportRow}>
            <Pressable testID="export-invoices" style={styles.exportBtn} onPress={() => exportFile("invoices")} disabled={!!exporting}>
              {exporting === "invoices" ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="download-outline" size={18} color={colors.brand} />}
              <Text style={styles.exportText}>{t("reports.invoicesXlsx")}</Text>
            </Pressable>
            <Pressable testID="export-receipts" style={styles.exportBtn} onPress={() => exportFile("receipts")} disabled={!!exporting}>
              {exporting === "receipts" ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="download-outline" size={18} color={colors.brand} />}
              <Text style={styles.exportText}>{t("reports.receiptsXlsx")}</Text>
            </Pressable>
          </View>

          <Pressable testID="open-bank-reconcile" style={styles.bankBtn} onPress={() => router.push("/(tabs)/bank")}>
            <Ionicons name="git-compare" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bankBtnTitle}>{t("bank.title")}</Text>
              <Text style={styles.bankBtnSub}>{t("bank.reconcileCta")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Legend({ color, label }: any) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}
function BasRow({ label, value, strong }: any) {
  return (
    <View style={styles.basRow}>
      <Text style={[styles.basLabel, strong && { color: colors.onSurface, fontWeight: weight.bold }]}>{label}</Text>
      <Text style={[styles.basValue, strong && { color: colors.brand, fontSize: 18 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  fyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, marginBottom: spacing.lg },
  fyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  fyLabel: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy, minWidth: 130, textAlign: "center" },
  heroRow: { flexDirection: "row", gap: spacing.md },
  heroCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  heroLabel: { color: colors.muted, fontSize: 12 },
  heroValue: { fontSize: 20, fontWeight: weight.heavy, marginTop: spacing.xs },
  netCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  netValue: { fontSize: 26, fontWeight: weight.heavy, marginTop: spacing.xs },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold, marginTop: spacing.xl, marginBottom: spacing.md },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 160, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  barCol: { flex: 1, alignItems: "center", height: "100%" },
  barTrack: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { width: 5, borderRadius: 2, minHeight: 2 },
  barLabel: { color: colors.muted, fontSize: 9, marginTop: spacing.xs },
  legend: { flexDirection: "row", gap: spacing.lg, justifyContent: "center", marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.muted, fontSize: 12 },
  basCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  basRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  basLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  basValue: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  exportRow: { flexDirection: "row", gap: spacing.md },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.lg, borderWidth: 1, borderColor: colors.border },
  exportText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  bankBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg },
  bankBtnTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  bankBtnSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
