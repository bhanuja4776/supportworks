import { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ScrollView, ActivityIndicator, Modal,
  TextInput, Platform, Switch,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Calendar } from "react-native-calendars";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { api, money, toDMY } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { DateInput } from "@/src/components/DateInput";
import { useConfirm } from "@/src/components/Celebration";
import { useTranslation } from "react-i18next";

const FILTERS = ["All", "Fuel", "Meals", "Supplies", "Equipment", "Travel", "Utilities", "General"];
const ICONS: Record<string, any> = {
  Fuel: "car", Meals: "restaurant", Supplies: "cube", Equipment: "hardware-chip",
  Travel: "airplane", Utilities: "flash", General: "pricetag",
};
const BILL_CATS = ["Subscription", "Insurance", "Vehicle", "Rent", "Utilities", "Phone", "Software", "Equipment", "General"];
const BILL_ICONS: Record<string, any> = {
  Subscription: "repeat", Insurance: "shield-checkmark", Vehicle: "car-sport", Rent: "home",
  Utilities: "flash", Phone: "call", Software: "laptop", Equipment: "hardware-chip", General: "pricetag",
};

const calTheme = {
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
  textSectionTitleColor: colors.muted,
  monthTextColor: colors.onSurface,
  dayTextColor: colors.onSurface,
  textDisabledColor: colors.border,
  todayTextColor: colors.brand,
  arrowColor: colors.brand,
  selectedDayBackgroundColor: colors.brand,
  selectedDayTextColor: colors.onBrand,
  textMonthFontWeight: "800" as const,
  textDayFontWeight: "600" as const,
};

export default function ExpensesHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [segment, setSegment] = useState<"receipts" | "bills" | "calendar">("receipts");
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string>("");
  const [viewImage, setViewImage] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().slice(0, 10));

  // bill form
  const [billModal, setBillModal] = useState(false);
  const [bName, setBName] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [bCat, setBCat] = useState("Subscription");
  const [bCost, setBCost] = useState("");
  const [bDue, setBDue] = useState("");
  const [bRenewal, setBRenewal] = useState("");
  const [bDD, setBDD] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [editingId, setEditingId] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([api.listReceipts(), api.listExpenses()]);
      setReceipts(r); setExpenses(e);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => (filter === "All" ? receipts : receipts.filter((r) => r.category === filter)),
    [receipts, filter]
  );
  const totalReceipts = useMemo(() => filtered.reduce((s, r) => s + (r.total || 0), 0), [filtered]);
  const totalReceiptsGst = useMemo(() => filtered.reduce((s, r) => s + (r.gst || 0), 0), [filtered]);
  const totalBills = useMemo(() => expenses.reduce((s, e) => s + (e.cost || 0), 0), [expenses]);

  // Calendar spend subtotals (based on receipts / money spent)
  const spendTotals = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let toDate = 0, week = 0, month = 0;
    receipts.forEach((r) => {
      const v = r.total || 0;
      toDate += v;
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        if (d >= startOfWeek) week += v;
        if (d >= startOfMonth) month += v;
      }
    });
    return { toDate, week, month };
  }, [receipts]);

  const resetBill = () => { setBName(""); setBDesc(""); setBCat("Subscription"); setBCost(""); setBDue(""); setBRenewal(""); setBDD(false); setEditingId(""); };
  const openEditBill = (item: any) => {
    setEditingId(item.id);
    setBName(item.name || ""); setBDesc(item.description || ""); setBCat(item.category || "Subscription");
    setBCost(item.cost ? String(item.cost) : ""); setBDue(item.due_date || ""); setBRenewal(item.renewal_date || "");
    setBDD(!!item.direct_debit); setBillModal(true);
  };
  const saveBill = async () => {
    if (!bName.trim()) return;
    setSavingBill(true);
    try {
      const body = {
        name: bName, description: bDesc, category: bCat, cost: parseFloat(bCost) || 0,
        due_date: bDue, renewal_date: bRenewal, direct_debit: bDD,
      };
      if (editingId) await api.updateExpense(editingId, body);
      else await api.createExpense(body);
      resetBill(); setBillModal(false); confirm(editingId ? t("vault.costUpdated") : t("vault.costAdded")); load();
    } finally { setSavingBill(false); }
  };

  // calendar marked dates
  const marked = useMemo(() => {
    const m: Record<string, any> = {};
    const push = (date: string, color: string) => {
      if (!date) return;
      const d = date.slice(0, 10);
      m[d] = m[d] || { dots: [] };
      if (!m[d].dots.some((dot: any) => dot.color === color)) m[d].dots.push({ color });
    };
    receipts.forEach((r) => push(r.date, colors.brand));
    expenses.forEach((e) => { push(e.due_date, colors.warning); push(e.renewal_date, colors.info); });
    m[selectedDay] = { ...(m[selectedDay] || {}), selected: true, selectedColor: colors.brand };
    return m;
  }, [receipts, expenses, selectedDay]);

  const dayItems = useMemo(() => {
    const items: { kind: string; label: string; sub: string; amount: number; tint: string; icon: string }[] = [];
    receipts.filter((r) => (r.date || "").slice(0, 10) === selectedDay).forEach((r) =>
      items.push({ kind: "receipt", label: r.merchant || t("vault.receipts"), sub: `${t("vault.receipts")} · ${r.category}`, amount: r.total || 0, tint: colors.brand, icon: ICONS[r.category] || "receipt" }));
    expenses.filter((e) => (e.due_date || "").slice(0, 10) === selectedDay).forEach((e) =>
      items.push({ kind: "bill", label: e.name, sub: `${t("vault.billDue")}${e.direct_debit ? " · " + t("vault.directDebit") : ""} · ${e.category}`, amount: e.cost || 0, tint: colors.warning, icon: BILL_ICONS[e.category] || "card" }));
    expenses.filter((e) => (e.renewal_date || "").slice(0, 10) === selectedDay).forEach((e) =>
      items.push({ kind: "renewal", label: e.name, sub: `${t("vault.renewal")} · ${e.category}`, amount: e.cost || 0, tint: colors.info, icon: "refresh" }));
    return items;
  }, [receipts, expenses, selectedDay, t]);

  return (
    <View style={styles.container} testID="receipts-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>{t("vault.title")}</Text>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>{segment === "bills" ? t("vault.totalScheduled") : t("vault.totalExpenses")}</Text>
          <Text style={styles.totalValue}>{money(segment === "bills" ? totalBills : totalReceipts)}</Text>
          {segment === "receipts" && <Text style={styles.gstSubtotal}>{t("vault.gstSubtotal", { amount: money(totalReceiptsGst) })}</Text>}
        </View>
        <View style={styles.segmentRow}>
          {(["receipts", "bills", "calendar"] as const).map((s) => (
            <Pressable key={s} testID={`seg-${s}`} onPress={() => setSegment(s)} style={[styles.segment, segment === s && styles.segmentActive]}>
              <Ionicons name={s === "receipts" ? "receipt" : s === "bills" ? "card" : "calendar"} size={15} color={segment === s ? colors.onBrand : colors.muted} />
              <Text style={[styles.segmentText, segment === s && styles.segmentTextActive]}>{s === "receipts" ? t("vault.receipts") : s === "bills" ? t("vault.billsCosts") : t("vault.calendar")}</Text>
            </Pressable>
          ))}
        </View>
        {segment === "receipts" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.lg }}>
            {FILTERS.map((f) => (
              <Pressable key={f} testID={`filter-${f}`} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f === "All" ? t("vault.all") : f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : segment === "receipts" ? (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>{t("vault.noReceipts")}</Text>
              <Pressable style={styles.scanCta} onPress={() => router.push("/(tabs)/scan")}>
                <Ionicons name="scan" size={16} color={colors.onBrand} />
                <Text style={styles.scanCtaText}>{t("vault.scanReceipt")}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const open = expandedId === item.id;
            return (
              <View style={styles.cardWrap} testID={`receipt-${item.id}`}>
                <Pressable style={styles.card} onPress={() => setExpandedId(open ? "" : item.id)}>
                  <View style={[styles.catIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name={ICONS[item.category] || "pricetag"} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.merchant}>{item.merchant || t("vault.unknownMerchant")}</Text>
                    <Text style={styles.meta}>{toDMY(item.date)} · {item.category}{item.archived ? ` · ${t("vault.archived")}` : ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.amount}>{money(item.total)}</Text>
                    <Text style={styles.gst}>GST {money(item.gst)}</Text>
                  </View>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} style={{ marginLeft: spacing.xs }} />
                </Pressable>
                {open && (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.detail}>
                    <View style={styles.detailHeaderRow}>
                      <Ionicons name="document-text" size={14} color={colors.brand} />
                      <Text style={styles.detailHeader}>{t("vault.digitalCopy")}</Text>
                    </View>
                    <DetailRow label={t("vault.merchant")} value={item.merchant || "—"} />
                    <DetailRow label={t("vault.date")} value={toDMY(item.date) || "—"} />
                    <DetailRow label={t("vault.category")} value={item.category} />
                    <DetailRow label={t("vault.payment")} value={item.payment_method || "—"} />
                    <DetailRow label={t("vault.gst")} value={money(item.gst)} />
                    <DetailRow label={t("vault.total")} value={money(item.total)} strong />
                    <View style={styles.detailActions}>
                      {item.image_url ? (
                        <Pressable testID={`view-original-${item.id}`} style={styles.viewOriginal} onPress={() => setViewImage(item.image_url)}>
                          <Ionicons name="image" size={16} color={colors.brand} />
                          <Text style={styles.viewOriginalText}>{t("vault.viewOriginal")}</Text>
                        </Pressable>
                      ) : <View />}
                      <Pressable testID={`del-receipt-${item.id}`} onPress={async () => { await api.deleteReceipt(item.id); load(); }} style={styles.delInline}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  </Animated.View>
                )}
              </View>
            );
          }}
        />
      ) : segment === "bills" ? (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>{t("vault.noCosts")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.billCard} testID={`expense-${item.id}`} onPress={() => openEditBill(item)}>
              <View style={[styles.catIcon, { backgroundColor: colors.warning + "22" }]}>
                <Ionicons name={BILL_ICONS[item.category] || "card"} size={20} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchant}>{item.name}</Text>
                {!!item.description && <Text style={styles.meta} numberOfLines={1}>{item.description}</Text>}
                <View style={styles.billMetaRow}>
                  {!!item.due_date && (
                    <View style={styles.billTag}>
                      <Ionicons name="time-outline" size={11} color={colors.warning} />
                      <Text style={[styles.billTagText, { color: colors.warning }]}>{t("vault.due", { date: toDMY(item.due_date) })}{item.direct_debit ? " · DD" : ""}</Text>
                    </View>
                  )}
                  {!!item.renewal_date && (
                    <View style={styles.billTag}>
                      <Ionicons name="refresh" size={11} color={colors.info} />
                      <Text style={[styles.billTagText, { color: colors.info }]}>{t("vault.renews", { date: toDMY(item.renewal_date) })}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                <Text style={styles.amount}>{money(item.cost)}</Text>
                <Pressable testID={`del-expense-${item.id}`} hitSlop={8} onPress={async () => { await api.deleteExpense(item.id); load(); }}>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={styles.calCard}>
            <Calendar
              testID="expense-calendar"
              theme={calTheme}
              markingType="multi-dot"
              markedDates={marked}
              onDayPress={(d: any) => setSelectedDay(d.dateString)}
              enableSwipeMonths
            />
          </View>
          <View style={styles.legendRow}>
            <Legend color={colors.brand} label={t("vault.receipts")} />
            <Legend color={colors.warning} label={t("vault.billDue")} />
            <Legend color={colors.info} label={t("vault.renewal")} />
          </View>
          <Text style={styles.dayHeader}>{new Date(selectedDay).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</Text>
          {dayItems.length === 0 ? (
            <Text style={styles.emptyLine}>{t("vault.nothingScheduled")}</Text>
          ) : dayItems.map((it, i) => (
            <View key={i} style={styles.dayItem}>
              <View style={[styles.catIcon, { backgroundColor: it.tint + "22" }]}>
                <Ionicons name={it.icon as any} size={18} color={it.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchant}>{it.label}</Text>
                <Text style={styles.meta}>{it.sub}</Text>
              </View>
              <Text style={styles.amount}>{money(it.amount)}</Text>
            </View>
          ))}

          <View style={styles.subtotalsCard} testID="spend-subtotals">
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>{t("vault.thisWeek")}</Text>
              <Text style={styles.subtotalValue}>{money(spendTotals.week)}</Text>
            </View>
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>{t("vault.thisMonth")}</Text>
              <Text style={styles.subtotalValue}>{money(spendTotals.month)}</Text>
            </View>
            <View style={[styles.subtotalRow, styles.subtotalDivider]}>
              <Text style={[styles.subtotalLabel, { color: colors.onSurface, fontWeight: weight.heavy }]}>{t("vault.toDate")}</Text>
              <Text style={[styles.subtotalValue, { color: colors.brand, fontSize: 17 }]}>{money(spendTotals.toDate)}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {segment === "bills" && (
        <Pressable testID="add-expense-fab" style={[styles.fab, { bottom: insets.bottom + spacing.lg }]} onPress={() => { resetBill(); setBillModal(true); }}>
          <Ionicons name="add" size={28} color={colors.onBrand} />
        </Pressable>
      )}

      {/* Add bill/cost modal */}
      <Modal visible={billModal} transparent animationType="slide" onRequestClose={() => { setBillModal(false); resetBill(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>{editingId ? t("vault.editCost") : t("vault.addCost")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.sm }}>
                {BILL_CATS.map((cat) => (
                  <Pressable key={cat} testID={`billcat-${cat}`} onPress={() => setBCat(cat)} style={[styles.catChip, bCat === cat && styles.catChipActive]}>
                    <Ionicons name={BILL_ICONS[cat]} size={14} color={bCat === cat ? colors.onBrand : colors.muted} />
                    <Text style={[styles.catChipText, bCat === cat && { color: colors.onBrand }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput testID="bill-name" value={bName} onChangeText={setBName} placeholder={t("vault.namePlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="bill-desc" value={bDesc} onChangeText={setBDesc} placeholder={t("vault.descPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="bill-cost" value={bCost} onChangeText={setBCost} placeholder={t("vault.costPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} keyboardType="decimal-pad" />
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>{t("vault.dueDate")}</Text>
                  <DateInput testID="bill-due" value={bDue} onChange={setBDue} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>{t("vault.renewalDate")}</Text>
                  <DateInput testID="bill-renewal" value={bRenewal} onChange={setBRenewal} style={styles.input} />
                </View>
              </View>
              <View style={styles.ddRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="repeat" size={18} color={colors.brand} />
                  <Text style={styles.ddText}>{t("vault.directDebit")}</Text>
                </View>
                <Switch testID="bill-dd" value={bDD} onValueChange={setBDD} trackColor={{ true: colors.brand, false: colors.border }} thumbColor={colors.onBrand} />
              </View>
              <Pressable testID="save-bill-btn" style={styles.primaryBtn} onPress={saveBill} disabled={savingBill}>
                {savingBill ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{editingId ? t("vault.updateCost") : t("vault.saveCost")}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage("")}>
        <Pressable style={styles.imageModal} onPress={() => setViewImage("")} testID="original-image-modal">
          <Text style={styles.imageModalHint}>{t("vault.tapClose")}</Text>
          {!!viewImage && <Image source={{ uri: viewImage }} style={styles.fullImage} contentFit="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, strong && { color: colors.brand, fontWeight: weight.heavy }]}>{value}</Text>
    </View>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: weight.heavy },
  totalBox: { marginTop: spacing.sm },
  totalLabel: { color: colors.muted, fontSize: 12 },
  totalValue: { color: colors.brand, fontSize: 28, fontWeight: weight.heavy },
  gstSubtotal: { color: colors.muted, fontSize: 12, marginTop: 2 },
  segmentRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.brand },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: weight.bold },
  segmentTextActive: { color: colors.onBrand },
  chip: { height: 36, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.medium },
  chipTextActive: { color: colors.onBrand, fontWeight: weight.bold },
  cardWrap: { marginBottom: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  billCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  billMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  billTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  billTagText: { fontSize: 11, fontWeight: weight.bold },
  detail: { backgroundColor: colors.surfaceTertiary, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, marginTop: -6, paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  detailHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  detailHeader: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, letterSpacing: 0.5 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  detailLabel: { color: colors.muted, fontSize: 13 },
  detailValue: { color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  detailActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  viewOriginal: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  viewOriginalText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  delInline: { padding: spacing.sm },
  catIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  merchant: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  amount: { color: colors.onSurface, fontSize: 16, fontWeight: weight.heavy },
  gst: { color: colors.muted, fontSize: 11, marginTop: 2 },
  empty: { alignItems: "center", marginTop: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
  emptyLine: { color: colors.muted, fontSize: 13, paddingVertical: spacing.md, textAlign: "center" },
  scanCta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  scanCtaText: { color: colors.onBrand, fontWeight: weight.bold },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  calCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", paddingBottom: spacing.sm },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginTop: spacing.md },
  legend: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.muted, fontSize: 12 },
  dayHeader: { color: colors.onSurface, fontSize: 16, fontWeight: weight.heavy, marginTop: spacing.xl, marginBottom: spacing.md },
  dayItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  subtotalsCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xl },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  subtotalDivider: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.xs, paddingTop: spacing.md },
  subtotalLabel: { color: colors.muted, fontSize: 14 },
  subtotalValue: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  catChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catChipText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginBottom: spacing.xs },
  ddRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs },
  ddText: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  imageModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  imageModalHint: { color: colors.muted, marginBottom: spacing.md, fontSize: 13 },
  fullImage: { width: "100%", height: "80%" },
});
