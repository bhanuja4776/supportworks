import { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator, Modal,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { api, money, toDMY } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useConfirm } from "@/src/components/Celebration";
import { pickPhoto, capturePhoto } from "@/src/photos";
import { useTranslation } from "react-i18next";

const FIELDS: { key: string; tk: string; placeholder: string; keyboard?: any }[] = [
  { key: "business_name", tk: "fBusinessName", placeholder: "e.g. CareFlow Supports" },
  { key: "abn", tk: "fAbn", placeholder: "12 345 678 901", keyboard: "number-pad" },
  { key: "email", tk: "fEmail", placeholder: "you@example.com", keyboard: "email-address" },
  { key: "phone", tk: "fPhone", placeholder: "0412 345 678", keyboard: "phone-pad" },
  { key: "bank_name", tk: "fBank", placeholder: "e.g. CommBank" },
  { key: "account_name", tk: "fAccountName", placeholder: "e.g. J Smith Support Services" },
  { key: "bsb", tk: "fBsb", placeholder: "063-000", keyboard: "number-pad" },
  { key: "account_number", tk: "fAccount", placeholder: "12345678", keyboard: "number-pad" },
];

const THEMES = ["#0A6B7D", "#7C3AED", "#0EA5E9", "#059669", "#E11D48", "#D97706", "#4F46E5", "#0F172A"];
const STYLES = [
  { key: "modern", icon: "sparkles" },
  { key: "classic", icon: "document-text" },
  { key: "minimal", icon: "remove" },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  // Track the last-saved snapshot so we can hide the save button until the user changes something.
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [justSaved, setJustSaved] = useState(false);

  // apply-to-drafts prompt
  const [applyModal, setApplyModal] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.getSettings();
      // Back-fill structured address from a legacy single-line address if needed.
      if (!s.address_street && !s.address_suburb && s.address) s.address_street = s.address;
      setForm(s);
      setSavedSnapshot(JSON.stringify(s));
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: any) => {
    setForm((f: any) => ({ ...f, [k]: v }));
    // Any edit invalidates the "just saved" state so the button reappears.
    if (justSaved) setJustSaved(false);
  };

  // Only compute dirtiness once form + snapshot exist so first render doesn't flicker the save button.
  const dirty = useMemo(() => {
    if (!form || !savedSnapshot) return false;
    return JSON.stringify(form) !== savedSnapshot;
  }, [form, savedSnapshot]);

  const composedAddress = (f: any) =>
    [f.address_street, [f.address_suburb, f.address_state, f.address_postcode].filter(Boolean).join(" ")]
      .filter((s) => s && s.trim())
      .join(", ");

  const setLogo = async (fromCamera: boolean) => {
    const p = fromCamera ? await capturePhoto() : await pickPhoto();
    if (p) set("logo_base64", p);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, address: composedAddress(form) };
      await api.putSettings(payload);
      confirm(t("settings.saved"));
      // Snapshot the just-saved state so the button hides until the next edit.
      setSavedSnapshot(JSON.stringify(payload));
      setForm(payload);
      setJustSaved(true);
      // Fade the "Saved" pill back to nothing after a couple of seconds.
      setTimeout(() => setJustSaved(false), 2200);
      // Offer to push updates to unsent (draft) invoices.
      const all = await api.listInvoices();
      const unsent = all.filter((i: any) => !i.sent_date && i.status !== "paid");
      if (unsent.length > 0) {
        setDrafts(unsent);
        const sel: Record<string, boolean> = {};
        unsent.forEach((i: any) => { sel[i.id] = true; });
        setSelectedIds(sel);
        setApplyModal(true);
      }
    } finally { setSaving(false); }
  };

  const toggleSel = (id: string) => setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  const allSelected = drafts.length > 0 && drafts.every((d) => selectedIds[d.id]);
  const setAll = (val: boolean) => {
    const sel: Record<string, boolean> = {};
    drafts.forEach((d) => { sel[d.id] = val; });
    setSelectedIds(sel);
  };

  const applyToDrafts = async () => {
    const ids = drafts.filter((d) => selectedIds[d.id]).map((d) => d.id);
    setApplying(true);
    try {
      if (ids.length) await api.applyBusinessToInvoices(ids);
      setApplyModal(false);
      confirm(ids.length ? t("settings.updated", { count: ids.length }) : t("settings.noChange"));
    } finally { setApplying(false); }
  };

  return (
    <View style={styles.container} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {!form ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>{t("settings.intro")}</Text>

            {/* Logo */}
            <Text style={styles.section}>{t("settings.logo")}</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {form.logo_base64 ? (
                  <Image source={{ uri: form.logo_base64.startsWith("http") ? form.logo_base64 : `data:image/png;base64,${form.logo_base64}` }} style={styles.logoImg} contentFit="contain" />
                ) : (
                  <Ionicons name="image-outline" size={26} color={colors.muted} />
                )}
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable testID="logo-upload" style={styles.smallBtn} onPress={() => setLogo(false)}>
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.brand} />
                    <Text style={styles.smallBtnText}>{t("settings.upload")}</Text>
                  </Pressable>
                  {!!form.logo_base64 && (
                    <Pressable testID="logo-remove" style={styles.smallBtn} onPress={() => set("logo_base64", "")}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                      <Text style={[styles.smallBtnText, { color: colors.error }]}>{t("settings.remove")}</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.hint}>{t("settings.logoHint")}</Text>
              </View>
            </View>

            {/* Theme */}
            <Text style={styles.section}>{t("settings.accent")}</Text>
            <View style={styles.swatchRow}>
              {THEMES.map((c) => (
                <Pressable key={c} testID={`theme-${c}`} onPress={() => set("invoice_theme", c)} style={[styles.swatch, { backgroundColor: c }, (form.invoice_theme || "#0A6B7D") === c && styles.swatchActive]}>
                  {(form.invoice_theme || "#0A6B7D") === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                </Pressable>
              ))}
            </View>

            {/* Style */}
            <Text style={styles.section}>{t("settings.style")}</Text>
            <View style={{ gap: spacing.sm }}>
              {STYLES.map((s) => {
                const on = (form.invoice_style || "modern") === s.key;
                return (
                  <Pressable key={s.key} testID={`style-${s.key}`} onPress={() => set("invoice_style", s.key)} style={[styles.styleRow, on && { borderColor: form.invoice_theme || colors.brand }]}>
                    <Ionicons name={s.icon as any} size={18} color={on ? (form.invoice_theme || colors.brand) : colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.styleLabel, on && { color: colors.onSurface }]}>{t(`settings.${s.key}`)}</Text>
                      <Text style={styles.hint}>{t(`settings.${s.key}Desc`)}</Text>
                    </View>
                    <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? (form.invoice_theme || colors.brand) : colors.muted} />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.section, { marginTop: spacing.lg }]}>{t("settings.details")}</Text>

            {/* Modern structured business address */}
            <View style={styles.addressCard}>
              <View style={styles.addressHead}>
                <View style={styles.addressIcon}><Ionicons name="location" size={16} color={colors.brand} /></View>
                <Text style={styles.addressTitle}>{t("settings.fAddress")}</Text>
              </View>
              <TextInput
                testID="setting-street"
                value={form.address_street || ""}
                onChangeText={(v) => set("address_street", v)}
                placeholder={t("settings.streetPlaceholder")}
                placeholderTextColor={colors.muted}
                style={styles.addressInput}
              />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput
                  testID="setting-suburb"
                  value={form.address_suburb || ""}
                  onChangeText={(v) => set("address_suburb", v)}
                  placeholder={t("settings.suburbPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={[styles.addressInput, { flex: 2, marginBottom: 0 }]}
                />
                <TextInput
                  testID="setting-state"
                  value={form.address_state || ""}
                  onChangeText={(v) => set("address_state", v.toUpperCase())}
                  placeholder={t("settings.statePlaceholder")}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  maxLength={3}
                  style={[styles.addressInput, { flex: 1, marginBottom: 0 }]}
                />
                <TextInput
                  testID="setting-postcode"
                  value={form.address_postcode || ""}
                  onChangeText={(v) => set("address_postcode", v)}
                  placeholder={t("settings.postcodePlaceholder")}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[styles.addressInput, { flex: 1, marginBottom: 0 }]}
                />
              </View>
            </View>

            {FIELDS.map((f) => (
              <View key={f.key} style={{ marginBottom: spacing.lg }}>
                <Text style={styles.label}>{t(`settings.${f.tk}`)}</Text>
                <TextInput
                  testID={`setting-${f.key}`}
                  value={form[f.key] || ""}
                  onChangeText={(v) => set(f.key, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.muted}
                  keyboardType={f.keyboard}
                  style={styles.input}
                />
              </View>
            ))}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {dirty ? (
              <Pressable testID="save-settings-btn" style={styles.primaryBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("settings.save")}</Text>}
              </Pressable>
            ) : justSaved ? (
              <View style={styles.savedBadge} testID="settings-saved-badge">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.savedText}>{t("settings.savedLbl")}</Text>
              </View>
            ) : (
              <View style={styles.upToDate} testID="settings-clean">
                <Ionicons name="checkmark-done" size={16} color={colors.muted} />
                <Text style={styles.upToDateText}>{t("settings.allSaved")}</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Apply-to-drafts prompt */}
      <Modal visible={applyModal} transparent animationType="slide" onRequestClose={() => setApplyModal(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("settings.applyTitle")}</Text>
            <Text style={styles.hint}>{t("settings.applyDesc")}</Text>
            <Pressable testID="apply-select-all" onPress={() => setAll(!allSelected)} style={styles.selectAll}>
              <Ionicons name={allSelected ? "checkbox" : "square-outline"} size={20} color={colors.brand} />
              <Text style={styles.selectAllText}>{allSelected ? t("settings.unselectAll") : t("settings.selectAll")}</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {drafts.map((d) => {
                const on = !!selectedIds[d.id];
                return (
                  <Pressable key={d.id} testID={`draft-${d.id}`} onPress={() => toggleSel(d.id)} style={styles.draftRow}>
                    <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? colors.brand : colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.draftNum}>{d.invoice_number} · {d.client_name || t("settings.participant")}</Text>
                      <Text style={styles.hint}>{t("settings.issued")} {toDMY(d.issue_date) || "—"} · {money(d.total)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable testID="apply-skip" style={[styles.primaryBtn, styles.ghostBtn, { flex: 1 }]} onPress={() => setApplyModal(false)}>
                <Text style={[styles.primaryText, { color: colors.onSurface }]}>{t("settings.notNow")}</Text>
              </Pressable>
              <Pressable testID="apply-confirm" style={[styles.primaryBtn, { flex: 1.4 }]} onPress={applyToDrafts} disabled={applying}>
                {applying ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("settings.applySelected")}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  intro: { color: colors.muted, fontSize: 14, marginBottom: spacing.lg },
  section: { color: colors.muted, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.8, marginBottom: spacing.sm },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  addressCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  addressHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  addressIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  addressTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  addressInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.onSurface, fontSize: 15, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.muted, fontSize: 11 },
  logoRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.lg },
  logoBox: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  smallBtnText: { color: colors.brand, fontWeight: weight.bold, fontSize: 12 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: colors.onSurface },
  styleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1.5, borderColor: colors.border },
  styleLabel: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: weight.heavy },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  ghostBtn: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  savedBadge: { height: 54, borderRadius: radius.md, backgroundColor: colors.success + "22", borderWidth: 1, borderColor: colors.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  savedText: { color: colors.success, fontWeight: weight.heavy, fontSize: 15 },
  upToDate: { height: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs },
  upToDateText: { color: colors.muted, fontSize: 13, fontWeight: weight.bold },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 19, fontWeight: weight.heavy, marginBottom: spacing.xs },
  selectAll: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  selectAllText: { color: colors.brand, fontWeight: weight.bold, fontSize: 14 },
  draftRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  draftNum: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
});
