import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, money, toDMY } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { shareInvoicePdf } from "@/src/pdf/invoicePdf";
import { useCelebration, useConfirm } from "@/src/components/Celebration";
import { useTranslation } from "react-i18next";

// Statuses shown in the status picker. Order = display order.
// "overdue" is a computed state — not user-settable, so we leave it out.
const STATUS_OPTIONS = [
  { key: "draft",  label: "invoiceDetail.statusDraft",  icon: "create",           color: colors.info },
  { key: "unpaid", label: "invoiceDetail.statusUnpaid", icon: "time",             color: colors.warning },
  { key: "paid",   label: "invoiceDetail.statusPaid",   icon: "checkmark-circle", color: colors.success },
  { key: "void",   label: "invoiceDetail.statusVoid",   icon: "close-circle",     color: colors.muted },
] as const;

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const celebrate = useCelebration();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    try { setInv(await api.getInvoice(id)); } catch {} finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const preview = () => {
    // In-app faithful preview — no more offloading to the OS PDF viewer for a "quick look".
    router.push(`/invoice/preview/${id}`);
  };

  const share = async () => {
    setSharing(true);
    try {
      // Mark sent first — the backend also auto-promotes draft → unpaid, so the
      // status pill instantly reflects that the invoice has left the drawer.
      await api.markInvoiceSent(id);
      const settings = await api.getSettings().catch(() => null);
      await shareInvoicePdf(inv, settings);
      confirm(t("invoiceDetail.invoiceSent"));
      load();
    } catch {} finally { setSharing(false); }
  };

  const changeStatus = async (next: string) => {
    if (!inv || next === inv.status) { setStatusOpen(false); return; }
    setStatusBusy(true);
    try {
      await api.setInvoiceStatus(id, next);
      if (next === "paid") celebrate(t("invoiceDetail.paidToast", { number: inv.invoice_number }), { sound: true });
      else confirm(t("invoiceDetail.statusUpdated"));
      load();
    } catch {} finally {
      setStatusBusy(false);
      setStatusOpen(false);
    }
  };

  if (loading || !inv) {
    return <View style={[styles.container, { justifyContent: "center" }]}><ActivityIndicator color={colors.brand} /></View>;
  }
  const paid = inv.status === "paid";
  const isDraft = inv.status === "draft";
  const currentStatus = STATUS_OPTIONS.find((s) => s.key === inv.status) || STATUS_OPTIONS[1]; // default to unpaid meta if unknown

  const duplicate = async () => {
    const dup = await api.duplicateInvoice(id);
    confirm(t("invoiceDetail.duplicated"));
    router.replace(`/invoice/${dup.id}`);
  };

  return (
    <View style={styles.container} testID="invoice-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{inv.invoice_number}</Text>
        <Pressable testID="share-pdf-btn" onPress={share} style={styles.iconBtn} disabled={sharing}>
          {sharing ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="share-outline" size={22} color={colors.brand} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Tappable status pill — opens a small picker so users can override
            the status manually (draft → unpaid → paid → void). Sending the
            invoice via the Send button also auto-promotes draft → unpaid. */}
        <Pressable
          testID="status-picker-open"
          style={[styles.statusBanner, { backgroundColor: currentStatus.color + "22" }]}
          onPress={() => setStatusOpen(true)}
        >
          <Ionicons name={currentStatus.icon as any} size={20} color={currentStatus.color} />
          <Text style={[styles.statusText, { color: currentStatus.color }]}>
            {t(currentStatus.label)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={currentStatus.color} style={{ marginLeft: spacing.xs }} />
        </Pressable>

        <View style={styles.editRow}>
          <Pressable testID="edit-invoice-btn" style={styles.editBtn} onPress={() => router.push({ pathname: "/invoice/new", params: { editId: id } })}>
            <Ionicons name="create-outline" size={16} color={colors.brand} />
            <Text style={styles.editText}>{isDraft ? t("invoiceDetail.addItems") : t("invoiceDetail.edit")}</Text>
          </Pressable>
          <Pressable testID="duplicate-invoice-btn" style={styles.editBtn} onPress={duplicate}>
            <Ionicons name="repeat" size={16} color={colors.brand} />
            <Text style={styles.editText}>{t("invoiceDetail.duplicate")}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t("invoiceDetail.billTo")}</Text>
          <Text style={styles.client}>{inv.client_name || t("invoiceDetail.participant")}</Text>
          {!!inv.client_company && <Text style={styles.meta}>{inv.client_company}</Text>}
          {!!inv.participant_ndis_number && <Text style={styles.meta}>{t("invoiceDetail.ndisNum", { number: inv.participant_ndis_number })}</Text>}
          {!!inv.client_address && <Text style={styles.meta}>{inv.client_address}</Text>}
          {!!inv.client_email && <Text style={styles.meta}>{inv.client_email}</Text>}
          <View style={styles.dateGrid}>
            <Text style={styles.meta}>{t("invoiceDetail.serviceDate", { date: toDMY(inv.service_date || inv.issue_date) || "—" })}</Text>
            <Text style={styles.meta}>{t("invoiceDetail.issued", { date: toDMY(inv.issue_date) || "—" })}</Text>
            <Text style={styles.meta}>{t("invoiceDetail.sent", { date: toDMY(inv.sent_date) || "—" })}</Text>
            <Text style={styles.meta}>{t("invoiceDetail.due", { date: toDMY(inv.due_date) || "—" })}</Text>
            {!!inv.ttp && <Text style={[styles.meta, { color: colors.brand, fontWeight: weight.bold }]}>{t("invoiceDetail.claimTtp")}</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("invoiceDetail.lineItems")}</Text>
        {inv.items.map((it: any, i: number) => (
          <View key={i} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemDesc}>{it.description || "—"}</Text>
              <Text style={styles.itemMeta}>{it.ndis_code ? `${it.ndis_code} · ` : ""}{it.quantity} × {money(it.rate)}{it.gst_free ? ` · ${t("invoiceDetail.gstFree")}` : ""}</Text>
              {!!(it.service_date || it.start_time) && (
                <Text style={styles.itemMeta}>
                  {[toDMY(it.service_date), it.start_time ? `${it.start_time}${it.end_time ? `–${it.end_time}` : ""}` : ""].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
            <Text style={styles.itemAmount}>{money(it.amount)}</Text>
          </View>
        ))}

        {!!inv.notes && (
          <>
            <Text style={styles.sectionTitle}>{t("invoiceDetail.notes")}</Text>
            <Text style={styles.notes}>{inv.notes}</Text>
          </>
        )}

        <View style={styles.totals}>
          <Row label={t("invoiceDetail.subtotal")} value={money(inv.subtotal)} />
          <Row label={t("invoiceDetail.gst")} value={money(inv.gst)} />
          <View style={styles.divider} />
          <Row label={t("invoiceDetail.total")} value={money(inv.total)} big />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="preview-invoice-btn" style={[styles.footerBtn, styles.ghost]} onPress={preview}>
          <Ionicons name="eye-outline" size={18} color={colors.onSurface} />
          <Text style={styles.ghostText}>{t("invoiceDetail.preview")}</Text>
        </Pressable>
        <Pressable testID="toggle-paid-btn" style={[styles.footerBtn, styles.ghost]} onPress={() => setStatusOpen(true)}>
          <Ionicons name={paid ? "arrow-undo" : "checkmark-done"} size={18} color={colors.onSurface} />
          <Text style={styles.ghostText}>{paid ? t("invoiceDetail.unpaid") : t("invoiceDetail.paidBtn")}</Text>
        </Pressable>
        <Pressable testID="share-invoice-btn" style={[styles.footerBtn, styles.primary]} onPress={share} disabled={sharing}>
          {sharing ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="send" size={18} color={colors.onBrand} /><Text style={styles.primaryText}>{isDraft ? t("invoiceDetail.sendAndMark") : t("invoiceDetail.send")}</Text></>)}
        </Pressable>
      </View>

      {/* Status picker — used by both the tap-status-banner and the footer
          Mark-Paid button. Gives users a fast manual override for the four
          settable states. */}
      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setStatusOpen(false)}>
          <View style={styles.pickerSheet} testID="status-picker-sheet">
            <Text style={styles.pickerTitle}>{t("invoiceDetail.statusPickTitle")}</Text>
            <Text style={styles.pickerSub}>{t("invoiceDetail.statusPickSub", { number: inv.invoice_number })}</Text>
            {STATUS_OPTIONS.map((opt) => {
              const isCurrent = opt.key === inv.status;
              return (
                <Pressable
                  key={opt.key}
                  testID={`status-opt-${opt.key}`}
                  onPress={() => changeStatus(opt.key)}
                  disabled={statusBusy}
                  style={[styles.pickerRow, isCurrent && { backgroundColor: opt.color + "18" }]}
                >
                  <View style={[styles.pickerIcon, { backgroundColor: opt.color + "22" }]}>
                    <Ionicons name={opt.icon as any} size={16} color={opt.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerLabel}>{t(opt.label)}</Text>
                    {isCurrent && <Text style={styles.pickerCurrent}>{t("invoiceDetail.statusCurrent")}</Text>}
                  </View>
                  {isCurrent && <Ionicons name="checkmark" size={20} color={opt.color} />}
                </Pressable>
              );
            })}
            {statusBusy && <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.sm }} />}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ label, value, big }: any) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, big && { fontSize: 16, color: colors.onSurface }]}>{label}</Text>
      <Text style={[styles.totalValue, big && { fontSize: 22, color: colors.brand }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  statusText: { fontWeight: weight.heavy, letterSpacing: 0.5 },
  editRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong },
  editText: { color: colors.brand, fontWeight: weight.bold, fontSize: 14 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.brand, fontSize: 11, fontWeight: weight.bold, letterSpacing: 1 },
  client: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy, marginTop: spacing.xs },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold, marginTop: spacing.xl, marginBottom: spacing.md },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemDesc: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  itemMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  itemAmount: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  notes: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20 },
  totals: { marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
  totalLabel: { color: colors.muted, fontSize: 14 },
  totalValue: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  footerBtn: { flex: 1, height: 54, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ghost: { borderWidth: 1, borderColor: colors.borderStrong },
  ghostText: { color: colors.onSurface, fontWeight: weight.bold },
  primary: { backgroundColor: colors.brand },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy },
  // ---- Status picker sheet ----
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  pickerSheet: { width: "100%", maxWidth: 380, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
  pickerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  pickerSub: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xs },
  pickerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pickerLabel: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  pickerCurrent: { color: colors.muted, fontSize: 11, marginTop: 1 },
});
