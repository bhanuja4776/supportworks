import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { api, money, toDMY } from "@/src/api";
import { shareInvoicePdf } from "@/src/pdf/invoicePdf";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useConfirm } from "@/src/components/Celebration";

const MGMT_LABEL: Record<string, string> = {
  self_managed: "Self-managed",
  plan_managed: "Plan-managed",
  ndia_managed: "NDIA-managed",
};

/**
 * In-app faithful preview of the printed invoice. Mirrors the ReportLab layout
 * (business header, BILL TO / meta split, coloured accent band, line-item table,
 * totals stack) so users can eyeball the whole invoice without leaving the app.
 * Share PDF stays available in the header.
 */
export default function InvoicePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [inv, setInv] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, settingsRes] = await Promise.all([
        api.getInvoice(id),
        api.getSettings().catch(() => null),
      ]);
      setInv(invRes);
      setSettings(settingsRes);
    } catch (e) {
      // Never swallow silently — a hidden TypeError here previously trapped users on a spinner.
      console.warn("[invoice preview] load failed", e);
    } finally { setLoading(false); }
  }, [id]);
  // Load once on mount — never trigger from the render body (would infinite-loop).
  useEffect(() => { load(); }, [load]);

  const share = async () => {
    if (!inv) return;
    setSharing(true);
    try {
      await shareInvoicePdf(inv, settings);
    } catch (e: any) {
      confirm(t("invoicePreview.pdfError", { msg: e?.message || "Please try again" }));
    } finally { setSharing(false); }
  };

  if (loading || !inv) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  // Business info shown on the preview.
  //   1. Start with live settings (what the user has just entered in Business Details).
  //   2. Overlay the invoice's `business` snapshot on top, so any fields captured at
  //      creation-time win (e.g. renamed business after sending an invoice keeps
  //      historical accuracy).
  //   This gracefully upgrades older invoices that were created before we started
  //   embedding a business snapshot — they'll pick up the current settings values.
  const biz = { ...(settings || {}), ...(inv.business || {}) };
  const accent = (biz.invoice_theme as string) || "#0A6B7D";
  const style = ((biz.invoice_style as string) || "modern").toLowerCase();
  const mgmt = (inv.management_type as string) || "self_managed";
  const isPlan = mgmt === "plan_managed";
  const bizLines = [biz.abn ? `ABN: ${biz.abn}` : "", biz.address, biz.email, biz.phone].filter(Boolean);
  const payLines: string[] = [];
  if (biz.account_name) payLines.push(`Account: ${biz.account_name}`);
  if (biz.bsb) payLines.push(`BSB: ${biz.bsb}`);
  if (biz.account_number) payLines.push(`Acct #: ${biz.account_number}`);

  const isDraft = inv.status === "draft";
  const paid = inv.status === "paid";

  return (
    <View style={styles.container} testID="invoice-preview-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="preview-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("invoicePreview.title")}</Text>
        <Pressable testID="preview-share-btn" onPress={share} style={styles.iconBtn} disabled={sharing}>
          {sharing ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="share-outline" size={22} color={colors.brand} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator>
        {/* The "paper" — matches PDF layout so you know exactly what's about to print. */}
        <View style={styles.paper}>
          {/* Header — style-aware. "Modern" gets an accent band; classic/minimal go for restrained. */}
          {style === "modern" ? (
            <View style={[styles.bandHead, { backgroundColor: accent }]}>
              <View style={{ flex: 1 }}>
                {biz.logo_base64 ? (
                  <Image source={{ uri: `data:image/png;base64,${biz.logo_base64}` }} style={styles.logo} contentFit="contain" />
                ) : (
                  <Text style={styles.bandBiz}>{biz.business_name || t("invoicePreview.yourBusiness")}</Text>
                )}
              </View>
              <Text style={styles.bandTitle}>TAX INVOICE</Text>
            </View>
          ) : style === "classic" ? (
            <View style={[styles.classicHead, { borderBottomColor: accent }]}>
              <View style={{ flex: 1 }}>
                {biz.logo_base64 ? (
                  <Image source={{ uri: `data:image/png;base64,${biz.logo_base64}` }} style={styles.logo} contentFit="contain" />
                ) : null}
              </View>
              <Text style={[styles.classicTitle, { color: accent }]}>TAX INVOICE</Text>
            </View>
          ) : (
            <View style={styles.minimalHead}>
              {biz.logo_base64 ? (
                <Image source={{ uri: `data:image/png;base64,${biz.logo_base64}` }} style={styles.logo} contentFit="contain" />
              ) : null}
              <Text style={[styles.minimalTitle, { color: accent }]}>TAX INVOICE</Text>
              <View style={[styles.minimalRule, { backgroundColor: accent }]} />
            </View>
          )}

          {/* Business info block */}
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.bizName}>{biz.business_name || t("invoicePreview.yourBusiness")}</Text>
            {bizLines.map((l: string, i: number) => (
              <Text key={i} style={styles.bizMeta}>{l}</Text>
            ))}
          </View>

          {/* Bill To + Invoice meta — two columns like the PDF */}
          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <Text style={[styles.colLabel, { color: accent }]}>{isPlan ? "BILL TO — PLAN MANAGER" : "BILL TO"}</Text>
              <Text style={styles.billName}>{inv.client_name || "Participant"}</Text>
              {!!inv.client_company && <Text style={styles.billMeta}>{inv.client_company}</Text>}
              {!!inv.participant_ndis_number && <Text style={styles.billMeta}>NDIS: {inv.participant_ndis_number}</Text>}
              {!!inv.client_address && <Text style={styles.billMeta}>{inv.client_address}</Text>}
              {!!inv.client_email && <Text style={styles.billMeta}>{inv.client_email}</Text>}
              {isPlan && (
                <View style={styles.pmBlock}>
                  <Text style={styles.pmTitle}>Send to plan manager:</Text>
                  {!!inv.plan_manager_name && <Text style={styles.billMeta}>{inv.plan_manager_name}</Text>}
                  {!!inv.plan_manager_email && <Text style={[styles.billMeta, { color: accent, fontWeight: weight.bold }]}>{inv.plan_manager_email}</Text>}
                </View>
              )}
            </View>
            <View style={styles.colHalf}>
              <Text style={[styles.colLabel, { color: accent }]}>INVOICE</Text>
              <Text style={styles.invNumber}>{inv.invoice_number}</Text>
              {/* Header no longer shows a top-level "Service date" — each line
                  now owns its own delivered date (shown under the description). */}
              <MetaRow label="Issued" value={toDMY(inv.issue_date) || "—"} />
              <MetaRow label="Sent" value={toDMY(inv.sent_date) || "—"} />
              <MetaRow label="Due" value={toDMY(inv.due_date) || "—"} />
              <MetaRow label="Status" value={String(inv.status || "unpaid").toUpperCase()} />
              <MetaRow label="Plan type" value={MGMT_LABEL[mgmt] || "Self-managed"} />
              {!!inv.ttp && <Text style={[styles.claim, { color: accent }]}>Claiming TTP</Text>}
            </View>
          </View>

          {/* Line items — table style matching the PDF grid */}
          <View style={[styles.tableHead, { backgroundColor: accent }]}>
            <Text style={[styles.thCode, styles.thText]}>Code</Text>
            <Text style={[styles.thDesc, styles.thText]}>Description</Text>
            <Text style={[styles.thQty, styles.thText]}>Qty</Text>
            <Text style={[styles.thRate, styles.thText]}>Rate</Text>
            <Text style={[styles.thAmt, styles.thText]}>Amount</Text>
          </View>
          {(inv.items || []).map((it: any, i: number) => {
            // Per-line delivered date (with a safe fallback for older invoices
            // that never captured a per-line date at creation-time).
            const lineDate = it.service_date || inv.service_date || "";
            const timeRange = it.start_time
              ? `${it.start_time}${it.end_time ? `–${it.end_time}` : ""}`
              : "";
            const subBits = [
              lineDate ? `Delivered: ${toDMY(lineDate)}` : "",
              timeRange,
            ].filter(Boolean);
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                <Text style={styles.tdCode}>{it.ndis_code || "—"}</Text>
                <View style={styles.tdDesc}>
                  <Text style={styles.tdText}>{it.description || "—"}</Text>
                  {subBits.length > 0 && (
                    <Text style={styles.tdSub}>{subBits.join(" · ")}</Text>
                  )}
                  {it.gst_free && <Text style={styles.tdGst}>GST-free</Text>}
                </View>
                <Text style={[styles.tdText, styles.tdQty]}>{it.quantity}</Text>
                <Text style={[styles.tdText, styles.tdRate]}>{money(it.rate)}</Text>
                <Text style={[styles.tdText, styles.tdAmt]}>{money(it.amount)}</Text>
              </View>
            );
          })}

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{money(inv.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST</Text>
              <Text style={styles.totalValue}>{money(inv.gst)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: "#000", fontWeight: weight.heavy, fontSize: 15 }]}>TOTAL DUE</Text>
              <Text style={[styles.totalValue, { color: accent, fontSize: 22, fontWeight: weight.heavy }]}>{money(inv.total)}</Text>
            </View>
          </View>

          {/* Notes */}
          {!!inv.notes && (
            <View style={styles.notesBlock}>
              <Text style={[styles.colLabel, { color: accent }]}>NOTES</Text>
              <Text style={styles.notesText}>{inv.notes}</Text>
            </View>
          )}

          {/* Payment details footer */}
          {payLines.length > 0 && (
            <View style={[styles.payFooter, { borderTopColor: accent }]}>
              <Text style={[styles.colLabel, { color: accent }]}>REMIT PAYMENT TO</Text>
              {payLines.map((l, i) => (
                <Text key={i} style={styles.payLine}>{l}</Text>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.paperHint}>{t("invoicePreview.paperHint")}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="preview-close-btn" onPress={() => router.back()} style={[styles.footerBtn, styles.ghost]}>
          <Ionicons name="close" size={18} color={colors.onSurface} />
          <Text style={styles.ghostText}>{t("invoicePreview.close")}</Text>
        </Pressable>
        <Pressable testID="preview-download-btn" onPress={share} style={[styles.footerBtn, styles.primary, { backgroundColor: accent }]} disabled={sharing}>
          {sharing ? <ActivityIndicator color={colors.onBrand} /> : (
            <>
              <Ionicons name="share" size={18} color={colors.onBrand} />
              <Text style={styles.primaryText}>{t("invoicePreview.sharePdf")}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const paperBg = "#FFFFFF";
const paperInk = "#0F2A32";
const paperMuted = "#5B7683";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  paper: { backgroundColor: paperBg, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  paperHint: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: spacing.md, fontStyle: "italic" },
  logo: { width: 90, height: 40 },
  bandHead: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: 6 },
  bandBiz: { color: "#fff", fontSize: 15, fontWeight: weight.heavy },
  bandTitle: { color: "#fff", fontSize: 20, fontWeight: weight.heavy, letterSpacing: 1 },
  classicHead: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm, borderBottomWidth: 1.4 },
  classicTitle: { fontSize: 20, fontWeight: weight.heavy, letterSpacing: 1 },
  minimalHead: { alignItems: "flex-start" },
  minimalTitle: { fontSize: 20, fontWeight: weight.heavy, letterSpacing: 1, marginTop: spacing.sm },
  minimalRule: { height: 2, alignSelf: "stretch", marginTop: spacing.xs },
  bizName: { color: paperInk, fontSize: 15, fontWeight: weight.heavy, marginBottom: 2 },
  bizMeta: { color: paperMuted, fontSize: 11, marginTop: 1 },
  twoCol: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  colHalf: { flex: 1 },
  colLabel: { fontSize: 10, fontWeight: weight.heavy, letterSpacing: 1, marginBottom: 4 },
  billName: { color: paperInk, fontSize: 13, fontWeight: weight.heavy, marginBottom: 2 },
  billMeta: { color: paperMuted, fontSize: 11, marginTop: 1 },
  pmBlock: { marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: "#E4EEF1" },
  pmTitle: { color: paperInk, fontSize: 11, fontWeight: weight.bold, marginBottom: 2 },
  invNumber: { color: paperInk, fontSize: 14, fontWeight: weight.heavy, marginBottom: spacing.xs },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  metaLabel: { color: paperMuted, fontSize: 11 },
  metaValue: { color: paperInk, fontSize: 11, fontWeight: weight.bold },
  claim: { fontSize: 11, fontWeight: weight.heavy, marginTop: spacing.xs },
  tableHead: { flexDirection: "row", marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  thText: { color: "#fff", fontSize: 10, fontWeight: weight.heavy, letterSpacing: 0.5 },
  thCode: { width: 74 },
  thDesc: { flex: 1 },
  thQty: { width: 30, textAlign: "right" },
  thRate: { width: 54, textAlign: "right" },
  thAmt: { width: 62, textAlign: "right" },
  tableRow: { flexDirection: "row", paddingVertical: spacing.sm, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#EDF3F5" },
  tableRowAlt: { backgroundColor: "#F7FAFB" },
  tdCode: { width: 74, color: paperInk, fontSize: 10, fontWeight: weight.bold },
  tdDesc: { flex: 1 },
  tdText: { color: paperInk, fontSize: 11 },
  tdSub: { color: paperMuted, fontSize: 10, marginTop: 1 },
  tdGst: { color: "#10B981", fontSize: 9, fontWeight: weight.bold, marginTop: 1 },
  tdQty: { width: 30, textAlign: "right", fontWeight: weight.bold },
  tdRate: { width: 54, textAlign: "right" },
  tdAmt: { width: 62, textAlign: "right", fontWeight: weight.heavy },
  totals: { alignItems: "flex-end", marginTop: spacing.md, paddingRight: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: 180, paddingVertical: 3 },
  totalLabel: { color: paperMuted, fontSize: 12 },
  totalValue: { color: paperInk, fontSize: 12, fontWeight: weight.bold },
  totalDivider: { height: 1, width: 180, backgroundColor: "#E4EEF1", marginVertical: spacing.xs },
  notesBlock: { marginTop: spacing.lg, backgroundColor: "#F7FAFB", padding: spacing.md, borderRadius: 4 },
  notesText: { color: paperInk, fontSize: 11, lineHeight: 15, marginTop: 4 },
  payFooter: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1.2 },
  payLine: { color: paperInk, fontSize: 11, marginTop: 2 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  footerBtn: { flex: 1, height: 54, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ghost: { borderWidth: 1, borderColor: colors.borderStrong },
  ghostText: { color: colors.onSurface, fontWeight: weight.bold },
  primary: { backgroundColor: colors.brand },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy },
});
