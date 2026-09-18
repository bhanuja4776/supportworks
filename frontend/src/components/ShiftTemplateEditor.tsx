import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, FlatList,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api, money } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { confirmAction } from "@/src/utils/confirm";
import { loadCatalogue, filterItems, FILTER_TAGS, type NdisItem } from "@/src/ndis";

const TRIP_ICONS = ["location", "home", "cart", "cafe", "medkit", "fitness", "school", "leaf", "paw", "bus"];

type Item = { ndis_code: string; description: string; quantity: number; rate: number };
type Stop = { name: string; address: string; icon: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: any | null;
  clients: any[];
};

/** Format loose digit entry as HH:MM. */
const fmtTime = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

export function ShiftTemplateEditor({ visible, onClose, onSaved, initial, clients }: Props) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [sName, setSName] = useState("");
  const [sAddr, setSAddr] = useState("");
  const [sIcon, setSIcon] = useState("location");
  const [recent, setRecent] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  // NDIS support-item picker — search + category chips (Self-Care / Community
  // Access / Transport / etc.) so users can build a template line without
  // knowing the raw code. Opens the same catalogue used on invoices.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catItems, setCatItems] = useState<NdisItem[]>([]);
  const [catQuery, setCatQuery] = useState("");
  const [catTags, setCatTags] = useState<string[]>([]);
  useEffect(() => {
    if (!pickerOpen || catItems.length) return;
    loadCatalogue().then((res) => setCatItems(res.catalogue.items || [])).catch(() => {});
  }, [pickerOpen, catItems.length]);
  const filteredCat = useMemo(() => filterItems(catItems, catQuery, catTags), [catItems, catQuery, catTags]);
  const toggleCatTag = (tag: string) => setCatTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  // Codes this participant already accepts — surfaced above the picker so
  // users can one-tap add their common codes without ever searching.
  const acceptedForClient: string[] = useMemo(() => {
    const c = clients.find((x: any) => x.id === clientId);
    return Array.isArray(c?.accepted_plan_codes) ? c!.accepted_plan_codes : [];
  }, [clients, clientId]);
  const suggestedForClient = useMemo(
    () => catItems.filter((it) => acceptedForClient.includes(it.code)),
    [catItems, acceptedForClient],
  );

  useEffect(() => {
    if (!visible) return;
    const c = initial || {};
    setName(c.name || "");
    setClientId(c.client_id || "");
    setStartTime(c.start_time || "");
    setEndTime(c.end_time || "");
    setTasks(c.routine_tasks || []);
    setItems((c.items || []).map((i: any) => ({
      ndis_code: i.ndis_code || "", description: i.description || "",
      quantity: Number(i.quantity) || 1, rate: Number(i.rate) || 0,
    })));
    setStops((c.trip_stops || []).map((s: any) => ({ name: s.name || "", address: s.address || "", icon: s.icon || "location" })));
    setTaskInput("");
    setSName(""); setSAddr(""); setSIcon("location");
  }, [visible, initial]);

  // Suggest previously-billed codes for the chosen participant.
  useEffect(() => {
    if (!visible || !clientId) { setRecent([]); return; }
    api.clientRecentCodes(clientId).then((r) => setRecent(Array.isArray(r) ? r : [])).catch(() => setRecent([]));
  }, [visible, clientId]);

  const addTask = () => {
    if (!taskInput.trim()) return;
    setTasks((p) => [...p, taskInput.trim()]);
    setTaskInput("");
  };

  const addRecent = (r: any) => {
    if (items.some((i) => i.ndis_code === r.code)) return;
    setItems((p) => [...p, { ndis_code: r.code, description: r.description || "", quantity: 1, rate: Number(r.rate) || 0 }]);
  };

  // Adds a fully editable prefill line from the catalogue picker. Description &
  // rate are pre-filled from the catalogue but the row remains editable.
  const applyPickedCode = (c: NdisItem) => {
    if (!items.some((i) => i.ndis_code === c.code)) {
      setItems((p) => [...p, { ndis_code: c.code, description: c.name || "", quantity: 1, rate: Number(c.rate) || 0 }]);
    }
    setPickerOpen(false);
    setCatQuery(""); setCatTags([]);
  };

  // Inline-editable line-item mutators — the pre-fill fix Drew asked for.
  const updateItem = (i: number, patch: Partial<Item>) => {
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const addStop = () => {
    if (!sName.trim() && !sAddr.trim()) return;
    setStops((p) => [...p, { name: sName.trim(), address: sAddr.trim(), icon: sIcon }]);
    setSName(""); setSAddr(""); setSIcon("location");
  };

  const total = items.reduce((sum, i) => sum + (i.quantity || 0) * (i.rate || 0), 0) * 1.1;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(), client_id: clientId, start_time: startTime, end_time: endTime,
        routine_tasks: tasks, items, trip_stops: stops,
      };
      if (isEdit) await api.updateShiftTemplate(initial.id, body);
      else await api.createShiftTemplate(body);
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  const remove = () => {
    confirmAction({
      title: t("shift.deleteTemplate"),
      message: t("shift.deleteTemplateMsg"),
      confirmText: t("shift.deleteTemplate"),
      destructive: true,
      onConfirm: async () => { await api.deleteShiftTemplate(initial.id); onSaved(); onClose(); },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <KeyboardAwareScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={24}>
            <Text style={styles.sheetTitle}>{isEdit ? t("shift.editTemplate") : t("shift.newTemplate")}</Text>

            <TextInput testID="tpl-name" value={name} onChangeText={setName} placeholder={t("shift.templateName")} placeholderTextColor={colors.muted} style={styles.input} />

            {/* Participant */}
            <Text style={styles.sectionLabel}>{t("shift.participant")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
              {clients.map((c) => (
                <Pressable key={c.id} testID={`tpl-client-${c.id}`} onPress={() => setClientId(clientId === c.id ? "" : c.id)}
                  style={[styles.clientChip, clientId === c.id && styles.clientChipOn]}>
                  <Text style={[styles.clientChipText, clientId === c.id && { color: colors.onBrand }]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Times */}
            <Text style={styles.sectionLabel}>{t("shift.times")}</Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>{t("shift.startTime")}</Text>
                <TextInput testID="tpl-start" value={startTime} onChangeText={(v) => setStartTime(fmtTime(v))} placeholder="09:00" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={5} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>{t("shift.endTime")}</Text>
                <TextInput testID="tpl-end" value={endTime} onChangeText={(v) => setEndTime(fmtTime(v))} placeholder="15:00" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={5} style={styles.input} />
              </View>
            </View>

            {/* Routine tasks */}
            <Text style={styles.sectionLabel}>{t("shift.routineTasks")}</Text>
            {tasks.map((task, i) => (
              <View key={i} style={styles.listRow} testID={`tpl-task-${i}`}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.brand} />
                <Text style={styles.listText}>{task}</Text>
                <Pressable testID={`tpl-task-remove-${i}`} onPress={() => setTasks((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput testID="tpl-task-input" value={taskInput} onChangeText={setTaskInput} placeholder={t("shift.addTaskPlaceholder")} placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, marginBottom: 0 }]} onSubmitEditing={addTask} />
              <Pressable testID="tpl-task-add" style={styles.addBtn} onPress={addTask}>
                <Ionicons name="add" size={20} color={colors.onBrand} />
              </Pressable>
            </View>

            {/* Billing items */}
            <Text style={styles.sectionLabel}>{t("shift.billing")}</Text>
            {!!clientId && recent.length > 0 && (
              <>
                <Text style={styles.hint}>{t("shift.recentCodes")}</Text>
                <View style={styles.chipsWrap}>
                  {recent.map((r) => (
                    <Pressable key={r.code} testID={`tpl-recent-${r.code}`} onPress={() => addRecent(r)} style={styles.codeChip}>
                      <Ionicons name="add" size={13} color={colors.brand} />
                      <Text style={styles.codeChipText}>{r.code} · {money(r.rate)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {suggestedForClient.length > 0 && (
              <>
                <Text style={styles.hint}>{t("shift.suggestedForClient")}</Text>
                <View style={styles.chipsWrap}>
                  {suggestedForClient.map((sc) => (
                    <Pressable key={`sc-${sc.code}`} testID={`tpl-suggest-${sc.code}`} onPress={() => applyPickedCode(sc)} style={[styles.codeChip, { borderColor: colors.brand + "88" }]}>
                      <Ionicons name="person-circle" size={13} color={colors.brand} />
                      <Text style={styles.codeChipText}>{sc.code} · {money(sc.rate)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {items.map((it, i) => (
              <View key={i} style={styles.itemCard} testID={`tpl-item-${i}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Ionicons name="pricetag" size={14} color={colors.brand} />
                  <Text style={styles.itemHead}>{t("shift.itemN", { n: i + 1 })}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.itemLine}>{money((it.quantity || 0) * (it.rate || 0))}</Text>
                  <Pressable testID={`tpl-item-remove-${i}`} onPress={() => setItems((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TextInput
                    testID={`tpl-item-code-${i}`}
                    value={it.ndis_code}
                    onChangeText={(v) => updateItem(i, { ndis_code: v })}
                    placeholder={t("shift.code")}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { flex: 1.2, marginBottom: spacing.sm }]}
                  />
                  <TextInput
                    testID={`tpl-item-qty-${i}`}
                    value={String(it.quantity)}
                    onChangeText={(v) => updateItem(i, { quantity: parseFloat(v) || 0 })}
                    keyboardType="decimal-pad"
                    placeholder={t("shift.qty")}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { flex: 0.7, marginBottom: spacing.sm }]}
                  />
                  <TextInput
                    testID={`tpl-item-rate-${i}`}
                    value={String(it.rate)}
                    onChangeText={(v) => updateItem(i, { rate: parseFloat(v) || 0 })}
                    keyboardType="decimal-pad"
                    placeholder={t("shift.rate")}
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { flex: 0.8, marginBottom: spacing.sm }]}
                  />
                </View>
                <TextInput
                  testID={`tpl-item-desc-${i}`}
                  value={it.description}
                  onChangeText={(v) => updateItem(i, { description: v })}
                  placeholder={t("shift.desc")}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { marginBottom: 0 }]}
                />
              </View>
            ))}

            {/* Two ways to add a new line: quick catalogue picker OR manual add. */}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <Pressable testID="tpl-open-picker" onPress={() => setPickerOpen(true)} style={styles.pickBtn}>
                <Ionicons name="search" size={16} color={colors.brand} />
                <Text style={styles.pickBtnText}>{t("shift.pickCode")}</Text>
              </Pressable>
              <Pressable testID="tpl-add-manual" onPress={() => setItems((p) => [...p, { ndis_code: "", description: "", quantity: 1, rate: 0 }])} style={styles.pickBtn}>
                <Ionicons name="add" size={16} color={colors.brand} />
                <Text style={styles.pickBtnText}>{t("shift.addManualLine")}</Text>
              </Pressable>
            </View>
            {items.length > 0 && (
              <Text style={styles.totalLine}>{t("shift.invoiceTotal", { amount: money(total) })}</Text>
            )}

            {/* Trip plan */}
            <Text style={styles.sectionLabel}>{t("shift.tripPlan")}</Text>
            {stops.map((s, i) => (
              <View key={i} style={styles.listRow} testID={`tpl-stop-${i}`}>
                <View style={styles.stopOrder}><Text style={styles.stopOrderText}>{i + 1}</Text></View>
                <Ionicons name={s.icon as any} size={15} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listText} numberOfLines={1}>{s.name || s.address}</Text>
                  {!!s.address && !!s.name && <Text style={styles.listMeta} numberOfLines={1}>{s.address}</Text>}
                </View>
                <Pressable testID={`tpl-stop-remove-${i}`} onPress={() => setStops((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
              {TRIP_ICONS.map((ic) => (
                <Pressable key={ic} testID={`tpl-stop-icon-${ic}`} onPress={() => setSIcon(ic)} style={[styles.iconSwatch, sIcon === ic && styles.iconSwatchOn]}>
                  <Ionicons name={ic as any} size={18} color={sIcon === ic ? colors.brand : colors.muted} />
                </Pressable>
              ))}
            </ScrollView>
            <TextInput testID="tpl-stop-name" value={sName} onChangeText={setSName} placeholder={t("shift.stopName")} placeholderTextColor={colors.muted} style={styles.input} />
            <View style={styles.addRow}>
              <TextInput testID="tpl-stop-address" value={sAddr} onChangeText={setSAddr} placeholder={t("shift.stopAddress")} placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, marginBottom: 0 }]} />
              <Pressable testID="tpl-stop-add" style={styles.addBtn} onPress={addStop}>
                <Ionicons name="add" size={20} color={colors.onBrand} />
              </Pressable>
            </View>

            <Pressable testID="tpl-save" style={styles.primaryBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("shift.saveTemplate")}</Text>}
            </Pressable>
            {isEdit && (
              <Pressable testID="tpl-delete" style={styles.deleteBtn} onPress={remove}>
                <Text style={styles.deleteText}>{t("shift.deleteTemplate")}</Text>
              </Pressable>
            )}
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>

      {/* NDIS support-item picker — same search + tag chips + list flow as the
          invoice picker, so users don't have to learn two different UIs. */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalWrap} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { height: "82%" }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("shift.pickCodeTitle")}</Text>
            <TextInput
              testID="tpl-picker-search"
              value={catQuery}
              onChangeText={setCatQuery}
              placeholder={t("shift.searchCode")}
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="none"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 46 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
              {FILTER_TAGS.map((tag) => {
                const on = catTags.includes(tag);
                return (
                  <Pressable key={tag} testID={`tpl-tag-${tag}`} onPress={() => toggleCatTag(tag)} style={[styles.tagChip, on && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                    <Text style={[styles.tagChipText, on && { color: colors.onBrand }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <FlatList
              data={filteredCat}
              keyExtractor={(c) => c.code}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator
              contentContainerStyle={{ paddingBottom: spacing.md }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`tpl-code-${item.code}`}
                  style={styles.codeRow}
                  onPress={() => applyPickedCode(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeRowCode}>{item.code}</Text>
                    <Text style={styles.codeRowLabel} numberOfLines={2}>{item.name}</Text>
                  </View>
                  <Text style={styles.codeRowRate}>{money(item.rate)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.hint}>{t("shift.noMatchingCodes")}</Text>}
            />
            <Pressable testID="tpl-picker-close" style={styles.cancelBtn} onPress={() => setPickerOpen(false)}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "92%" },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  sectionLabel: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginBottom: spacing.xs },
  hint: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
  clientChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  clientChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  clientChipText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  listText: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  listMeta: { color: colors.muted, fontSize: 11, marginTop: 1 },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  codeChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  codeChipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  totalLine: { color: colors.success, fontSize: 13, fontWeight: weight.heavy, textAlign: "right", marginBottom: spacing.sm },
  stopOrder: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  stopOrderText: { color: colors.onBrand, fontSize: 10, fontWeight: weight.heavy },
  iconSwatch: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  iconSwatchOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  deleteBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.xs },
  deleteText: { color: colors.error, fontWeight: weight.bold },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.sm },
  cancelText: { color: colors.muted, fontWeight: weight.bold },
  itemCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemHead: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.heavy, letterSpacing: 0.4 },
  itemLine: { color: colors.brand, fontSize: 13, fontWeight: weight.heavy },
  pickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand + "66" },
  pickBtnText: { color: colors.brand, fontSize: 13, fontWeight: weight.heavy },
  tagChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  tagChipText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: weight.bold },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  codeRowCode: { color: colors.brand, fontSize: 12, fontWeight: weight.heavy, marginBottom: 2 },
  codeRowLabel: { color: colors.onSurface, fontSize: 12, lineHeight: 16 },
  codeRowRate: { color: colors.brand, fontSize: 13, fontWeight: weight.heavy },
});
