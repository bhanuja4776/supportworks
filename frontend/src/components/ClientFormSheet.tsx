import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal,
  ActivityIndicator, Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { capturePhoto, pickPhoto } from "@/src/photos";
import { ClientAvatar } from "@/src/components/ClientAvatar";
import { DateInput } from "@/src/components/DateInput";

export const AVATAR_COLORS = ["#00E5FF", "#34D399", "#FBBF24", "#F87171", "#38BDF8", "#A78BFA", "#F472B6", "#FB923C"];
export const AVATAR_ICONS = ["person", "happy", "heart", "accessibility", "walk", "body", "medkit", "star", "paw", "home"];
const SEX_OPTS = ["Male", "Female", "Other"];
const CARE_SUGGESTIONS = [
  "Communication", "Mobility", "Personal care", "Routines & preferences",
  "Likes & dislikes", "Health & safety", "Goals",
];

type CareSection = { title: string; text: string };

export function ageFromDob(dob?: string): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 130 ? `${age} yrs` : "";
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: any | null;
  defaultColorIndex?: number;
};

export function ClientFormSheet({ visible, onClose, onSaved, initial, defaultColorIndex = 0 }: Props) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [icon, setIcon] = useState("person");
  const [photo, setPhoto] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [careSections, setCareSections] = useState<CareSection[]>([]);
  const [medications, setMedications] = useState("");
  const [behaviours, setBehaviours] = useState("");
  const [company, setCompany] = useState("");
  const [ndis, setNdis] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [planManager, setPlanManager] = useState("");
  const [planBudget, setPlanBudget] = useState("");
  // NDIS plan management defaults + accepted plan codes for invoice validation.
  const [mgmtType, setMgmtType] = useState<"self_managed" | "plan_managed" | "ndia_managed">("self_managed");
  const [planMgrName, setPlanMgrName] = useState("");
  const [planMgrEmail, setPlanMgrEmail] = useState("");
  const [acceptedCodes, setAcceptedCodes] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [nokName, setNokName] = useState("");
  const [nokRelationship, setNokRelationship] = useState("");
  const [nokPhone, setNokPhone] = useState("");
  const [nokEmail, setNokEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const c = initial || {};
    setName(c.name || "");
    setColor(c.color || AVATAR_COLORS[defaultColorIndex % AVATAR_COLORS.length]);
    setIcon(c.icon || "person");
    setPhoto(c.photo_base64 || "");
    setDob(c.date_of_birth || "");
    setSex(c.sex || "");
    setCareSections(Array.isArray(c.care_sections) ? c.care_sections : []);
    setMedications(c.medications || "");
    setBehaviours(c.behaviours || "");
    setCompany(c.company || "");
    setNdis(c.ndis_number || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setPlanManager(c.plan_manager || "");
    setPlanBudget(c.plan_budget ? String(c.plan_budget) : "");
    setMgmtType((c.management_type as any) || "self_managed");
    setPlanMgrName(c.plan_manager_name || "");
    setPlanMgrEmail(c.plan_manager_email || "");
    setAcceptedCodes(Array.isArray(c.accepted_plan_codes) ? c.accepted_plan_codes : []);
    setCodeInput("");
    const nok = c.next_of_kin || {};
    setNokName(nok.name || "");
    setNokRelationship(nok.relationship || "");
    setNokPhone(nok.phone || "");
    setNokEmail(nok.email || "");
  }, [visible, initial, defaultColorIndex]);

  const addSection = (title: string) => setCareSections((p) => [...p, { title, text: "" }]);
  const removeSection = (i: number) => setCareSections((p) => p.filter((_, idx) => idx !== i));
  const updateSection = (i: number, patch: Partial<CareSection>) =>
    setCareSections((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name, color, icon, photo_base64: photo, date_of_birth: dob, sex,
        care_sections: careSections.filter((s) => s.title.trim() || s.text.trim()),
        medications, behaviours, company, ndis_number: ndis, email, phone,
        address, plan_manager: planManager, plan_budget: parseFloat(planBudget) || 0,
        management_type: mgmtType,
        plan_manager_name: planMgrName.trim(),
        plan_manager_email: planMgrEmail.trim(),
        accepted_plan_codes: acceptedCodes,
        next_of_kin: { name: nokName.trim(), relationship: nokRelationship.trim(), phone: nokPhone.trim(), email: nokEmail.trim() },
      };
      if (isEdit) await api.updateClient(initial.id, body);
      else await api.createClient(body);
      onSaved();
      onClose();
      Alert.alert(
        isEdit ? "Changes saved" : "Client added",
        isEdit ? `${name}'s profile has been updated.` : `${name} has been added to your participants.`
      );
    } catch (e: any) {
      Alert.alert("Couldn't save client", e?.message || "Something went wrong. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <KeyboardAwareScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={24}>
            <Text style={styles.sheetTitle}>{isEdit ? "Edit Client" : "New Client"}</Text>

            {/* Avatar preview + photo actions */}
            <View style={styles.avatarPreview}>
              <ClientAvatar name={name} color={color} icon={icon} photo={photo} size={72} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable testID="client-photo-camera" style={styles.photoBtn} onPress={async () => { const p = await capturePhoto(); if (p) setPhoto(p); }}>
                    <Ionicons name="camera" size={16} color={colors.brand} />
                    <Text style={styles.photoBtnText}>Snap</Text>
                  </Pressable>
                  <Pressable testID="client-photo-upload" style={styles.photoBtn} onPress={async () => { const p = await pickPhoto(); if (p) setPhoto(p); }}>
                    <Ionicons name="image" size={16} color={colors.brand} />
                    <Text style={styles.photoBtnText}>Upload</Text>
                  </Pressable>
                  {!!photo && (
                    <Pressable testID="client-photo-remove" style={styles.photoBtn} onPress={() => setPhoto("")}>
                      <Ionicons name="close" size={16} color={colors.error} />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.hint}>Add a photo, or pick an icon & colour below.</Text>
              </View>
            </View>

            {!photo && (
              <>
                <Text style={styles.miniLabel}>Icon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
                  {AVATAR_ICONS.map((ic) => (
                    <Pressable key={ic} testID={`icon-${ic}`} onPress={() => setIcon(ic)} style={[styles.iconSwatch, { borderColor: icon === ic ? color : colors.border, backgroundColor: icon === ic ? color + "22" : colors.surfaceTertiary }]}>
                      <Ionicons name={ic as any} size={20} color={icon === ic ? color : colors.muted} />
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.miniLabel}>Colour</Text>
                <View style={styles.colorRow}>
                  {AVATAR_COLORS.map((cl) => (
                    <Pressable key={cl} testID={`color-${cl}`} onPress={() => setColor(cl)} style={[styles.colorSwatch, { backgroundColor: cl, borderWidth: color === cl ? 3 : 0 }]}>
                      {color === cl && <Ionicons name="checkmark" size={14} color="#00121A" />}
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <TextInput testID="client-name" value={name} onChangeText={setName} placeholder="Full name *" placeholderTextColor={colors.muted} style={styles.input} />

            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1.3 }}>
                <Text style={styles.miniLabel}>Date of birth{ageFromDob(dob) ? ` · ${ageFromDob(dob)}` : ""}</Text>
                <DateInput testID="client-dob" value={dob} onChange={setDob} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Sex</Text>
                <View style={styles.segRow}>
                  {SEX_OPTS.map((s) => (
                    <Pressable key={s} testID={`sex-${s}`} onPress={() => setSex(sex === s ? "" : s)} style={[styles.seg, sex === s && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                      <Text style={[styles.segText, sex === s && { color: colors.onBrand }]}>{s[0]}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Care profile</Text>
            {careSections.map((sec, i) => (
              <View key={i} style={styles.careSection}>
                <View style={styles.careSectionHead}>
                  <TextInput
                    testID={`care-title-${i}`}
                    value={sec.title}
                    onChangeText={(v) => updateSection(i, { title: v })}
                    placeholder="Section title (e.g. Communication)"
                    placeholderTextColor={colors.muted}
                    style={styles.careTitleInput}
                  />
                  <Pressable testID={`care-remove-${i}`} onPress={() => removeSection(i)} hitSlop={8} style={styles.careRemove}>
                    <Ionicons name="trash-outline" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <TextInput
                  testID={`care-text-${i}`}
                  value={sec.text}
                  onChangeText={(v) => updateSection(i, { text: v })}
                  placeholder="Details…"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.multiline]}
                  multiline
                />
              </View>
            ))}
            <Text style={styles.hint}>Add only the sections that matter for this participant — tap to add.</Text>
            <View style={styles.chipsWrap}>
              {CARE_SUGGESTIONS.filter((s) => !careSections.some((cs) => cs.title === s)).map((s) => (
                <Pressable key={s} testID={`care-chip-${s}`} onPress={() => addSection(s)} style={styles.chip}>
                  <Ionicons name="add" size={14} color={colors.brand} />
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
              <Pressable testID="care-chip-custom" onPress={() => addSection("")} style={[styles.chip, { borderStyle: "dashed" }]}>
                <Ionicons name="create-outline" size={14} color={colors.brand} />
                <Text style={styles.chipText}>Custom</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Medications required</Text>
            <TextInput testID="client-medications" value={medications} onChangeText={setMedications} placeholder="List medications, doses & timing" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline />

            <Text style={styles.sectionLabel}>Needs, concerns & behaviours</Text>
            <TextInput testID="client-behaviours" value={behaviours} onChangeText={setBehaviours} placeholder="Important notes on support needs, triggers & behaviours" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline />

            <Text style={styles.sectionLabel}>Next of kin / emergency contact</Text>
            <TextInput testID="nok-name" value={nokName} onChangeText={setNokName} placeholder="Contact name" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput testID="nok-relationship" value={nokRelationship} onChangeText={setNokRelationship} placeholder="Relationship (e.g. Mother, Guardian)" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput testID="nok-phone" value={nokPhone} onChangeText={setNokPhone} placeholder="Phone" placeholderTextColor={colors.muted} style={styles.input} keyboardType="phone-pad" />
            <TextInput testID="nok-email" value={nokEmail} onChangeText={setNokEmail} placeholder="Email (optional)" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.sectionLabel}>Billing & contact</Text>
            <Text style={styles.miniLabel}>Plan management type</Text>
            <View style={styles.mgmtRow}>
              {[
                { key: "self_managed", label: "Self", icon: "person" },
                { key: "plan_managed", label: "Plan managed", icon: "business" },
                { key: "ndia_managed", label: "NDIA", icon: "shield" },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  testID={`mgmt-${opt.key}`}
                  onPress={() => setMgmtType(opt.key as any)}
                  style={[styles.mgmtChip, mgmtType === opt.key && styles.mgmtChipOn]}
                >
                  <Ionicons name={opt.icon as any} size={14} color={mgmtType === opt.key ? colors.onBrand : colors.brand} />
                  <Text style={[styles.mgmtChipText, mgmtType === opt.key && { color: colors.onBrand }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            {mgmtType === "plan_managed" && (
              <View style={styles.mgmtBlock}>
                <Text style={styles.hint}>Invoices for this participant will be routed to their plan manager.</Text>
                <TextInput testID="pm-name" value={planMgrName} onChangeText={setPlanMgrName} placeholder="Plan manager business name" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput testID="pm-email" value={planMgrEmail} onChangeText={setPlanMgrEmail} placeholder="Plan manager email (invoices sent here)" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
              </View>
            )}
            <Text style={styles.miniLabel}>Accepted plan codes (optional)</Text>
            <Text style={styles.hint}>List codes this participant&apos;s plan will fund. Codes outside this list will show a warning on invoices — reduces rejection risk.</Text>
            <View style={styles.chipsWrap}>
              {acceptedCodes.map((c, idx) => (
                <View key={`${c}-${idx}`} style={styles.codeChip} testID={`plan-code-${c}`}>
                  <Text style={styles.codeChipText}>{c}</Text>
                  <Pressable testID={`remove-plan-code-${c}`} hitSlop={8} onPress={() => setAcceptedCodes((p) => p.filter((_, i) => i !== idx))}>
                    <Ionicons name="close" size={14} color={colors.brand} />
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={styles.addCodeRow}>
              <TextInput
                testID="plan-code-input"
                value={codeInput}
                onChangeText={setCodeInput}
                placeholder="e.g. 01_011_0107_1_1"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                onSubmitEditing={() => { const v = codeInput.trim(); if (v && !acceptedCodes.includes(v)) setAcceptedCodes([...acceptedCodes, v]); setCodeInput(""); }}
              />
              <Pressable
                testID="add-plan-code"
                style={styles.addCodeBtn}
                onPress={() => { const v = codeInput.trim(); if (v && !acceptedCodes.includes(v)) setAcceptedCodes([...acceptedCodes, v]); setCodeInput(""); }}
              >
                <Ionicons name="add" size={20} color={colors.onBrand} />
              </Pressable>
            </View>
            <TextInput testID="client-ndis" value={ndis} onChangeText={setNdis} placeholder="NDIS number" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.md }]} keyboardType="number-pad" />
            <TextInput testID="client-company" value={company} onChangeText={setCompany} placeholder="Company / Organisation" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput testID="client-email" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
            <TextInput testID="client-phone" value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.muted} style={styles.input} keyboardType="phone-pad" />
            <TextInput testID="client-address" value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput testID="client-plan-manager" value={planManager} onChangeText={setPlanManager} placeholder="Plan manager (optional)" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput testID="client-plan-budget" value={planBudget} onChangeText={setPlanBudget} placeholder="NDIS plan budget total (AUD)" placeholderTextColor={colors.muted} style={styles.input} keyboardType="decimal-pad" />

            <Pressable testID="save-client-btn" style={styles.primaryBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{isEdit ? "Save Changes" : "Add Client"}</Text>}
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "92%" },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  avatarPreview: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  photoBtnText: { color: colors.brand, fontWeight: weight.bold, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 11 },
  iconSwatch: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.sm },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderColor: "#fff" },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginBottom: spacing.xs, marginTop: spacing.xs },
  sectionLabel: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  segRow: { flexDirection: "row", gap: spacing.xs },
  seg: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  segText: { color: colors.onSurfaceTertiary, fontWeight: weight.bold, fontSize: 13 },
  careSection: { backgroundColor: colors.surfaceTertiary + "66", borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  careSectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  careTitleInput: { flex: 1, color: colors.brand, fontSize: 14, fontWeight: weight.bold, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  careRemove: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  chipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { color: colors.muted, fontWeight: weight.bold },
  mgmtRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  mgmtChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  mgmtChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  mgmtChipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  mgmtBlock: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.brand + "44" },
  codeChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand + "66" },
  codeChipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  addCodeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  addCodeBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
