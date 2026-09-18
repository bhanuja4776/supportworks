import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, Platform,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { confirmAction } from "@/src/utils/confirm";

export type ActivityTemplate = {
  id: string;
  name: string;
  activity_type: string;   // activity | routine | outing | meal | therapy | exercise | other
  duration_min: number;
  location: string;
  distance_km: number;
  description: string;
  notes: string;
  checklist: string[];
};

const TYPE_OPTIONS: { key: string; label: string; icon: string; color: string }[] = [
  { key: "routine",  label: "Routine",  icon: "list",       color: colors.info },
  { key: "activity", label: "Activity", icon: "sparkles",   color: colors.brand },
  { key: "outing",   label: "Outing",   icon: "map",        color: colors.warning },
  { key: "meal",     label: "Meal",     icon: "restaurant", color: colors.success },
  { key: "therapy",  label: "Therapy",  icon: "medkit",     color: "#F472B6" },
  { key: "exercise", label: "Exercise", icon: "walk",       color: "#A78BFA" },
  { key: "other",    label: "Other",    icon: "ellipse",    color: colors.muted },
];

export function typeMeta(key: string) {
  return TYPE_OPTIONS.find((o) => o.key === key) || TYPE_OPTIONS[TYPE_OPTIONS.length - 1];
}

type Props = {
  visible: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  /** When set, tapping a template will call this callback instead of opening the editor. */
  onPick?: (tpl: ActivityTemplate) => void;
};

/**
 * Manage a participant's reusable activity/routine templates. Users can create
 * templates once (e.g. "Morning shower routine", "Community walk") then apply
 * them to a shift's planner in one tap instead of re-typing every time.
 */
export function ActivityTemplatesEditor({ visible, clientId, clientName, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const [list, setList] = useState<ActivityTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ActivityTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try { setList(await api.listActivityTemplates(clientId)); } catch { setList([]); }
    finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (tpl: ActivityTemplate) => { setEditing(tpl); setEditorOpen(true); };
  const remove = (tpl: ActivityTemplate) => confirmAction({
    title: t("activityTpl.deleteTitle"),
    message: t("activityTpl.deleteMsg", { name: tpl.name }),
    confirmText: t("activityTpl.delete"),
    destructive: true,
    onConfirm: async () => { await api.deleteActivityTemplate(clientId, tpl.id); load(); },
  });

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t("activityTpl.title")}</Text>
                <Text style={styles.sub}>{t("activityTpl.subtitle", { name: clientName })}</Text>
              </View>
              <Pressable testID="close-activity-tpls" onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Pressable testID="new-activity-tpl" onPress={openNew} style={styles.newBtn}>
              <Ionicons name="add-circle" size={18} color={colors.onBrand} />
              <Text style={styles.newBtnText}>{t("activityTpl.newBtn")}</Text>
            </Pressable>
            {loading ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
            ) : list.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="albums-outline" size={30} color={colors.muted} />
                <Text style={styles.emptyText}>{t("activityTpl.empty")}</Text>
                <Text style={styles.emptyHint}>{t("activityTpl.emptyHint")}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 420 }}>
                {list.map((tpl) => {
                  const m = typeMeta(tpl.activity_type);
                  return (
                    <Pressable
                      key={tpl.id}
                      testID={`activity-tpl-${tpl.id}`}
                      style={styles.row}
                      onPress={() => (onPick ? onPick(tpl) : openEdit(tpl))}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: m.color + "22" }]}>
                        <Ionicons name={m.icon as any} size={16} color={m.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{tpl.name}</Text>
                        <Text style={styles.rowMeta}>
                          {[m.label, tpl.duration_min ? `${tpl.duration_min} min` : "", tpl.location].filter(Boolean).join(" · ")}
                        </Text>
                        {!!tpl.description && <Text style={styles.rowDesc} numberOfLines={1}>{tpl.description}</Text>}
                      </View>
                      {!onPick && (
                        <>
                          <Pressable testID={`edit-tpl-${tpl.id}`} hitSlop={8} onPress={() => openEdit(tpl)} style={styles.iconBtn}>
                            <Ionicons name="pencil" size={16} color={colors.muted} />
                          </Pressable>
                          <Pressable testID={`del-tpl-${tpl.id}`} hitSlop={8} onPress={() => remove(tpl)} style={styles.iconBtn}>
                            <Ionicons name="trash-outline" size={16} color={colors.muted} />
                          </Pressable>
                        </>
                      )}
                      {onPick && <Ionicons name="chevron-forward" size={18} color={colors.brand} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <TemplateForm
        visible={editorOpen}
        initial={editing}
        clientId={clientId}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); load(); }}
      />
    </>
  );
}

function TemplateForm({ visible, initial, clientId, onClose, onSaved }: {
  visible: boolean;
  initial: ActivityTemplate | null;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [name, setName] = useState("");
  const [aType, setAType] = useState("activity");
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");
  const [distance, setDistance] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [step, setStep] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const i = initial;
    setName(i?.name || "");
    setAType(i?.activity_type || "activity");
    setDuration(i?.duration_min ? String(i.duration_min) : "60");
    setLocation(i?.location || "");
    setDistance(i?.distance_km ? String(i.distance_km) : "");
    setDescription(i?.description || "");
    setNotes(i?.notes || "");
    setChecklist(Array.isArray(i?.checklist) ? i.checklist : []);
    setStep("");
  }, [visible, initial]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        activity_type: aType,
        duration_min: Math.max(0, parseInt(duration, 10) || 0),
        location: location.trim(),
        distance_km: Math.max(0, parseFloat(distance) || 0),
        description: description.trim(),
        notes: notes.trim(),
        checklist,
      };
      if (isEdit) await api.updateActivityTemplate(clientId, initial!.id, body);
      else await api.createActivityTemplate(clientId, body);
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
        <View style={[styles.sheet, { maxHeight: "92%" }]}>
          <View style={styles.handle} />
          <KeyboardAwareScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={24}>
            <Text style={styles.title}>{isEdit ? t("activityTpl.editTitle") : t("activityTpl.newTitle")}</Text>
            <Text style={styles.miniLabel}>{t("activityTpl.name")}</Text>
            <TextInput testID="tpl-name" value={name} onChangeText={setName} placeholder={t("activityTpl.namePh")} placeholderTextColor={colors.muted} style={styles.input} />

            <Text style={styles.miniLabel}>{t("activityTpl.type")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              {TYPE_OPTIONS.map((o) => {
                const on = aType === o.key;
                return (
                  <Pressable
                    key={o.key}
                    testID={`tpl-type-${o.key}`}
                    onPress={() => setAType(o.key)}
                    style={[styles.typeChip, on && { backgroundColor: o.color, borderColor: o.color }]}
                  >
                    <Ionicons name={o.icon as any} size={13} color={on ? colors.onBrand : o.color} />
                    <Text style={[styles.typeChipText, on && { color: colors.onBrand }]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>{t("activityTpl.duration")}</Text>
                <TextInput testID="tpl-duration" value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="60" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>{t("activityTpl.distance")}</Text>
                <TextInput testID="tpl-distance" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            </View>

            <Text style={styles.miniLabel}>{t("activityTpl.location")}</Text>
            <TextInput testID="tpl-location" value={location} onChangeText={setLocation} placeholder={t("activityTpl.locationPh")} placeholderTextColor={colors.muted} style={styles.input} />

            <Text style={styles.miniLabel}>{t("activityTpl.description")}</Text>
            <TextInput testID="tpl-desc" value={description} onChangeText={setDescription} placeholder={t("activityTpl.descriptionPh")} placeholderTextColor={colors.muted} style={styles.input} multiline />

            <Text style={styles.miniLabel}>{t("activityTpl.checklist")}</Text>
            {checklist.map((c, idx) => (
              <View key={idx} style={styles.stepRow} testID={`tpl-step-${idx}`}>
                <Ionicons name="ellipse-outline" size={16} color={colors.brand} />
                <Text style={styles.stepText}>{c}</Text>
                <Pressable onPress={() => setChecklist((p) => p.filter((_, i) => i !== idx))} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
              <TextInput
                testID="tpl-step-input"
                value={step}
                onChangeText={setStep}
                placeholder={t("activityTpl.stepPh")}
                placeholderTextColor={colors.muted}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                onSubmitEditing={() => { if (step.trim()) { setChecklist([...checklist, step.trim()]); setStep(""); } }}
              />
              <Pressable
                testID="tpl-add-step"
                style={styles.addBtn}
                onPress={() => { if (step.trim()) { setChecklist([...checklist, step.trim()]); setStep(""); } }}
              >
                <Ionicons name="add" size={20} color={colors.onBrand} />
              </Pressable>
            </View>

            <Text style={styles.miniLabel}>{t("activityTpl.notes")}</Text>
            <TextInput testID="tpl-notes" value={notes} onChangeText={setNotes} placeholder={t("activityTpl.notesPh")} placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} multiline />

            <Pressable testID="save-tpl-btn" style={styles.primary} onPress={save} disabled={saving || !name.trim()}>
              {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{isEdit ? t("activityTpl.saveEdit") : t("activityTpl.saveNew")}</Text>}
            </Pressable>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>{t("activityTpl.cancel")}</Text>
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.md },
  newBtnText: { color: colors.onBrand, fontWeight: weight.heavy },
  empty: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  emptyHint: { color: colors.muted, fontSize: 12, textAlign: "center", paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowName: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowDesc: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  iconBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginBottom: spacing.xs, marginTop: spacing.xs },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  typeChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  typeChipText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  stepText: { flex: 1, color: colors.onSurface, fontSize: 13 },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  primary: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  cancel: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { color: colors.muted, fontWeight: weight.bold },
});
