import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { api, money } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useConfirm } from "@/src/components/Celebration";
import { confirmAction } from "@/src/utils/confirm";
import { useTranslation } from "react-i18next";

const toDMY = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export default function Bank() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [csv, setCsv] = useState("");
  const [txns, setTxns] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    try { setTxns(await api.bankTransactions()); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const uri = res.assets[0].uri;
      let text = "";
      if (Platform.OS === "web") {
        text = await (await fetch(uri)).text();
      } else {
        const FS = await import("expo-file-system/legacy");
        text = await FS.readAsStringAsync(uri);
      }
      setCsv(text);
    } catch {
      confirm(t("bank.fileError"));
    }
  };

  const doImport = async () => {
    if (!csv.trim()) { confirm(t("bank.noText")); return; }
    setImporting(true);
    try {
      const r = await api.bankImport(csv);
      confirm(t("bank.imported", { count: r.imported }));
      setCsv("");
      await load();
    } finally { setImporting(false); }
  };

  const toggleSelect = async (tx: any) => {
    setTxns((prev) => prev.map((x) => (x.id === tx.id ? { ...x, selected: !x.selected } : x)));
    api.bankUpdateTxn(tx.id, { selected: !tx.selected }).catch(() => {});
  };
  const setAll = async (val: boolean) => {
    setTxns((prev) => prev.map((x) => ({ ...x, selected: val })));
    await Promise.all(txns.map((x) => api.bankUpdateTxn(x.id, { selected: val }).catch(() => {})));
  };

  const ignore = async (tx: any) => {
    setTxns((prev) => prev.filter((x) => x.id !== tx.id));
    api.bankUpdateTxn(tx.id, { status: "ignored" }).catch(() => {});
  };

  const reconcileOne = async (tx: any) => {
    if (!tx.suggested_invoice_id) return;
    await api.bankReconcile(tx.id, tx.suggested_invoice_id).catch(() => {});
    confirm(t("bank.reconciledOne"));
    load();
  };

  const matchable = txns.filter((x) => x.selected && x.status === "unmatched" && x.suggested_invoice_id);
  const reconcileSelected = async () => {
    if (matchable.length === 0) return;
    setReconciling(true);
    try {
      for (const tx of matchable) await api.bankReconcile(tx.id, tx.suggested_invoice_id).catch(() => {});
      confirm(t("bank.reconciled", { count: matchable.length }));
      await load();
    } finally { setReconciling(false); }
  };

  const clearAll = () =>
    confirmAction({
      title: t("bank.clearTitle"), message: t("bank.clearMsg"), confirmText: t("bank.clear"), destructive: true,
      onConfirm: async () => { await api.bankClear().catch(() => {}); confirm(t("bank.cleared")); load(); },
    });

  const selectedCredits = txns.filter((x) => x.selected && x.amount > 0);
  const selectedIn = selectedCredits.reduce((s, x) => s + x.amount, 0);
  const allSelected = txns.length > 0 && txns.every((x) => x.selected);

  return (
    <View style={styles.container} testID="bank-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("bank.title")}</Text>
        {txns.length > 0 ? (
          <Pressable testID="bank-clear-btn" onPress={clearAll} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.muted} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t("bank.intro")}</Text>

        <Text style={styles.label}>{t("bank.pasteLabel")}</Text>
        <TextInput
          testID="bank-csv-input"
          value={csv}
          onChangeText={setCsv}
          placeholder={t("bank.pastePlaceholder")}
          placeholderTextColor={colors.muted}
          multiline
          style={styles.csvInput}
        />
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
          <Pressable testID="bank-pick-file" onPress={pickFile} style={styles.ghostBtn}>
            <Ionicons name="document-attach" size={18} color={colors.brand} />
            <Text style={styles.ghostText}>{t("bank.pickFile")}</Text>
          </Pressable>
          <Pressable testID="bank-import-btn" onPress={doImport} style={styles.importBtn} disabled={importing}>
            {importing ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="sync" size={18} color={colors.onBrand} /><Text style={styles.importText}>{t("bank.import")}</Text></>)}
          </Pressable>
        </View>

        {txns.length > 0 && (
          <>
            <View style={styles.txnHead}>
              <Text style={styles.sectionTitle}>{t("bank.transactions")}</Text>
              <Pressable testID="bank-select-all" onPress={() => setAll(!allSelected)}>
                <Text style={styles.selectAll}>{allSelected ? t("bank.unselectAll") : t("bank.selectAll")}</Text>
              </Pressable>
            </View>
            <Text style={styles.privacy}>{t("bank.privacy")}</Text>

            {txns.map((tx) => {
              const credit = tx.amount > 0;
              const matched = tx.status === "matched";
              return (
                <View key={tx.id} style={[styles.txnRow, matched && { opacity: 0.6 }]} testID={`txn-${tx.id}`}>
                  <Pressable testID={`txn-select-${tx.id}`} onPress={() => toggleSelect(tx)} hitSlop={6} disabled={matched}>
                    <Ionicons name={tx.selected ? "checkbox" : "square-outline"} size={22} color={tx.selected ? colors.brand : colors.muted} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnDesc} numberOfLines={1}>{tx.description || "—"}</Text>
                    <Text style={styles.txnMeta}>{toDMY(tx.date)} · {credit ? t("bank.credit") : t("bank.debit")}</Text>
                    {matched ? (
                      <Text style={styles.matchedTag}>✓ {tx.suggested_invoice_number || ""}</Text>
                    ) : tx.suggested_invoice_id ? (
                      <Pressable testID={`reconcile-${tx.id}`} onPress={() => reconcileOne(tx)} style={styles.matchBtn}>
                        <Ionicons name="link" size={13} color={colors.success} />
                        <Text style={styles.matchText}>{t("bank.matchTo", { number: tx.suggested_invoice_number })} · {t("bank.markPaid")}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.noMatch}>{t("bank.noMatch")}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.txnAmount, { color: credit ? colors.success : colors.error }]}>{credit ? "+" : ""}{money(tx.amount)}</Text>
                    {!matched && (
                      <Pressable testID={`ignore-${tx.id}`} onPress={() => ignore(tx)} hitSlop={6} style={{ marginTop: 4 }}>
                        <Text style={styles.ignore}>{t("bank.ignore")}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {txns.length === 0 && !importing && (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={38} color={colors.muted} />
            <Text style={styles.emptyText}>{t("bank.empty")}</Text>
          </View>
        )}
      </ScrollView>

      {matchable.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Text style={styles.footSummary}>{t("bank.selectedCredits", { count: selectedCredits.length, amount: money(selectedIn) })}</Text>
          <Pressable testID="reconcile-selected-btn" style={styles.reconcileBtn} onPress={reconcileSelected} disabled={reconciling}>
            {reconciling ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="checkmark-done" size={18} color={colors.onBrand} /><Text style={styles.importText}>{t("bank.reconcileSelected", { count: matchable.length })}</Text></>)}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  intro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  csvInput: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 13, borderWidth: 1, borderColor: colors.border, minHeight: 90, textAlignVertical: "top", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  ghostBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary },
  ghostText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  importBtn: { flex: 1.2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, backgroundColor: colors.brand },
  importText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 14 },
  txnHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.heavy },
  selectAll: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  privacy: { color: colors.muted, fontSize: 12, fontStyle: "italic", marginTop: spacing.xs, marginBottom: spacing.md },
  txnRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  txnDesc: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  txnMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: weight.heavy },
  matchBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  matchText: { color: colors.success, fontSize: 12, fontWeight: weight.bold },
  matchedTag: { color: colors.success, fontSize: 12, fontWeight: weight.bold, marginTop: 4 },
  noMatch: { color: colors.muted, fontSize: 12, marginTop: 4 },
  ignore: { color: colors.muted, fontSize: 12, fontWeight: weight.bold },
  empty: { alignItems: "center", marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.muted, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, gap: spacing.sm },
  footSummary: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, textAlign: "center" },
  reconcileBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
});
