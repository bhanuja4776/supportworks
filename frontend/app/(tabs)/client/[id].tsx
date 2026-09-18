import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Platform, ActivityIndicator, Linking, Alert,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { api, money, toDMY } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { DateInput } from "@/src/components/DateInput";
import { ensureNotifPermission, scheduleReminder } from "@/src/notifications";
import { capturePhoto, pickPhoto } from "@/src/photos";
import { useConfirm } from "@/src/components/Celebration";
import { ClientAvatar } from "@/src/components/ClientAvatar";
import { ClientFormSheet, ageFromDob } from "@/src/components/ClientFormSheet";
import { ActivityTemplatesEditor, typeMeta as activityMeta } from "@/src/components/ActivityTemplatesEditor";
import { confirmAction } from "@/src/utils/confirm";
import { useTranslation } from "react-i18next";

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [ov, setOv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [remModal, setRemModal] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rDate, setRDate] = useState(new Date().toISOString().slice(0, 10));
  const [rTime, setRTime] = useState("09:00");
  const [savingRem, setSavingRem] = useState(false);
  const [permHint, setPermHint] = useState("");
  const [docs, setDocs] = useState<any[]>([]);
  const [docModal, setDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("Service Agreement");
  const [docFile, setDocFile] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [aiScanBusy, setAiScanBusy] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [viewDocItem, setViewDocItem] = useState<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [budget, setBudget] = useState<any>(null);
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const [notesModal, setNotesModal] = useState(false);
  const [activityTplsOpen, setActivityTplsOpen] = useState(false);
  const [activityTpls, setActivityTpls] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [data, dl, bud, sn, ats] = await Promise.all([
        api.clientOverview(id),
        api.listClientDocs(id).catch(() => []),
        api.clientBudget(id).catch(() => null),
        api.listClientNotes(id).catch(() => []),
        api.listActivityTemplates(id).catch(() => []),
      ]);
      setOv(data);
      setNotes(data.client.notes || "");
      setDocs(dl);
      setBudget(bud);
      setSavedNotes(sn || []);
      setActivityTpls(Array.isArray(ats) ? ats : []);
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addDoc = async () => {
    if (!docTitle.trim()) return;
    setSavingDoc(true);
    try {
      await api.createClientDoc({
        client_id: id, title: docTitle, type: docType, file_base64: docFile,
        extracted_text: extracted?.full_text || "", doc_date: extracted?.date || "",
        key_parties: Array.isArray(extracted?.key_parties) ? extracted.key_parties : [],
      });
      setDocTitle(""); setDocFile(""); setDocType("Service Agreement"); setExtracted(null); setDocModal(false);
      confirm(t("clientDetail.docAdded"));
      load();
    } finally { setSavingDoc(false); }
  };

  // Scanner document mode: photograph a document, GPT-4o Vision extracts readable text.
  const aiScan = async () => {
    if (aiScanBusy) return;
    const p = await capturePhoto();
    if (!p) return;
    setAiScanBusy(true);
    try {
      setDocFile(p);
      const res = await api.scanDocument(p);
      const d = res?.data || {};
      if (d.title && !docTitle.trim()) setDocTitle(d.title);
      if (["Service Agreement", "Consent", "Plan", "Document"].includes(d.doc_type)) setDocType(d.doc_type);
      setExtracted(d);
    } catch {
      Alert.alert(t("clientDetail.aiScanFailed"));
    } finally { setAiScanBusy(false); }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try { await api.updateClient(id, { notes }); confirm(t("clientDetail.notesSaved")); } finally { setSavingNotes(false); }
  };

  const addReminder = async () => {
    if (!rTitle.trim()) return;
    setSavingRem(true);
    setPermHint("");
    try {
      const iso = new Date(`${rDate}T${rTime}:00`).toISOString();
      await api.createReminder({ client_id: id, title: rTitle, remind_at: iso });
      const granted = await ensureNotifPermission();
      if (granted) {
        await scheduleReminder(t("clientDetail.reminderNotifTitle", { name: ov?.client?.name || "" }), rTitle, iso);
      } else {
        setPermHint(t("clientDetail.permHint"));
      }
      setRTitle("");
      if (granted) setRemModal(false);
      confirm(t("clientDetail.reminderSet"));
      load();
    } finally { setSavingRem(false); }
  };

  const toggleReminder = async (r: any) => { await api.updateReminder(r.id, { done: !r.done }); load(); };

  const confirmDelete = () => {
    confirmAction({
      title: t("clientDetail.deleteTitle"),
      message: t("clientDetail.deleteMsg", { name: ov?.client?.name || t("clientDetail.deleteFallback") }),
      confirmText: t("clientDetail.delete"),
      destructive: true,
      onConfirm: async () => { await api.deleteClient(id); router.back(); },
    });
  };

  if (loading) {
    return <View style={[styles.container, { justifyContent: "center" }]}><ActivityIndicator color={colors.brand} /></View>;
  }

  if (loadError || !ov) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", gap: spacing.md, padding: spacing.xl }]} testID="client-load-error">
        <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
        <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: weight.bold, textAlign: "center" }}>
          {t("clientDetail.loadErrorTitle")}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{t("clientDetail.loadErrorMsg")}</Text>
        <Pressable testID="client-load-error-back" onPress={() => router.back()} style={styles.saveNotes}>
          <Text style={styles.saveNotesText}>{t("clientDetail.backToClients")}</Text>
        </Pressable>
      </View>
    );
  }

  const c = ov.client;
  const color = c.color || colors.brand;
  const pending = ov.invoices_pending || [];
  const paid = ov.invoices_paid || [];

  return (
    <View style={styles.container} testID="client-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{c.name}</Text>
        <View style={styles.headerActions}>
          <Pressable testID="saved-notes-btn" onPress={() => setNotesModal(true)} style={styles.iconBtnSmall}>
            <Ionicons name="reader-outline" size={22} color={colors.brand} />
            {savedNotes.length > 0 && (
              <View style={styles.notesBadge}><Text style={styles.notesBadgeText}>{savedNotes.length}</Text></View>
            )}
          </Pressable>
          <Pressable testID="edit-client-btn" onPress={() => setEditVisible(true)} style={styles.iconBtnSmall}>
            <Ionicons name="create-outline" size={22} color={colors.brand} />
          </Pressable>
          <Pressable testID="delete-client-btn" onPress={confirmDelete} style={styles.iconBtnSmall}>
            <Ionicons name="trash-outline" size={20} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {/* Profile */}
        <View style={styles.profile}>
          <ClientAvatar name={c.name} color={color} icon={c.icon} photo={c.photo_base64} size={76} />
          <Text style={styles.name}>{c.name}</Text>
          {(!!c.date_of_birth || !!c.sex) && (
            <Text style={styles.ndis}>
              {[c.sex, ageFromDob(c.date_of_birth), toDMY(c.date_of_birth)].filter(Boolean).join(" · ")}
            </Text>
          )}
          {!!c.company && <Text style={styles.ndis}>{c.company}</Text>}
          {!!c.ndis_number && <Text style={styles.ndis}>{t("clientDetail.ndisNum", { number: c.ndis_number })}</Text>}
          {!!c.address && <Text style={styles.ndis}>{c.address}</Text>}
          {!!c.email && <Text style={styles.ndis}>{c.email}</Text>}
          {!!c.plan_manager && <Text style={styles.ndis}>{t("clientDetail.planManager", { name: c.plan_manager })}</Text>}
          <View style={styles.contactRow}>
            {!!c.phone && (
              <Pressable testID="call-btn" style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                <Ionicons name="call" size={16} color={colors.brand} />
                <Text style={styles.contactText}>{t("clientDetail.call")}</Text>
              </Pressable>
            )}
            {!!c.email && (
              <Pressable testID="email-btn" style={styles.contactBtn} onPress={() => Linking.openURL(`mailto:${c.email}`)}>
                <Ionicons name="mail" size={16} color={colors.brand} />
                <Text style={styles.contactText}>{t("clientDetail.email")}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Money stats */}
        <View style={styles.statsRow}>
          <Stat label={t("clientDetail.statBilled")} value={money(ov.total_billed)} tint={colors.info} />
          <Stat label={t("clientDetail.statPaid")} value={money(ov.total_paid)} tint={colors.success} />
          <Stat label={t("clientDetail.statPending")} value={money(ov.total_pending)} tint={colors.warning} />
        </View>

        {/* NDIS plan budget tracker */}
        <Pressable style={styles.budgetCard} testID="budget-card" onPress={() => setEditVisible(true)}>
          {budget && budget.budget > 0 ? (
            <>
              <View style={styles.budgetHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="wallet" size={16} color={colors.brand} />
                  <Text style={styles.budgetTitle}>{t("clientDetail.budgetTitle")}</Text>
                </View>
                <Text style={[styles.budgetPct, { color: budget.percent_used >= 90 ? colors.error : budget.percent_used >= 70 ? colors.warning : colors.success }]}>
                  {t("clientDetail.pctUsed", { pct: budget.percent_used })}
                </Text>
              </View>
              <View style={styles.budgetBarTrack}>
                <View style={[styles.budgetBarFill, {
                  width: `${Math.min(100, budget.percent_used)}%`,
                  backgroundColor: budget.percent_used >= 90 ? colors.error : budget.percent_used >= 70 ? colors.warning : colors.success,
                }]} />
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetMeta}>{t("clientDetail.claimed", { amount: money(budget.spent) })}</Text>
                <Text style={[styles.budgetRemain, budget.remaining < 0 && { color: colors.error }]}>
                  {budget.remaining < 0 ? t("clientDetail.over", { amount: money(Math.abs(budget.remaining)) }) : t("clientDetail.left", { amount: money(budget.remaining) })}
                </Text>
                <Text style={styles.budgetMeta}>{t("clientDetail.ofBudget", { amount: money(budget.budget) })}</Text>
              </View>
            </>
          ) : (
            <View style={styles.budgetEmpty}>
              <Ionicons name="wallet-outline" size={18} color={colors.muted} />
              <Text style={styles.budgetEmptyText}>{t("clientDetail.budgetEmpty")}</Text>
            </View>
          )}
        </Pressable>

        {/* Next of Kin */}
        {!!(c.next_of_kin && (c.next_of_kin.name || c.next_of_kin.phone)) && (
          <>
            <SectionTitle icon="people" title={t("clientDetail.nextOfKin")} />
            <View style={styles.rowItem} testID="nok-card">
              <View style={[styles.invIcon, { backgroundColor: colors.brand + "22" }]}>
                <Ionicons name="person" size={16} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.next_of_kin.name || "—"}</Text>
                {!!c.next_of_kin.relationship && <Text style={styles.rowMeta}>{c.next_of_kin.relationship}</Text>}
                {!!c.next_of_kin.email && <Text style={styles.rowMeta}>{c.next_of_kin.email}</Text>}
              </View>
              {!!c.next_of_kin.phone && (
                <Pressable testID="nok-call" onPress={() => Linking.openURL(`tel:${c.next_of_kin.phone}`)} style={styles.contactBtn}>
                  <Ionicons name="call" size={16} color={colors.brand} />
                  <Text style={styles.contactText}>{c.next_of_kin.phone}</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Care Profile */}
        {(!!c.medications || !!c.behaviours || (c.care_sections || []).some((s: any) => s.title || s.text)) && (
          <>
            <SectionTitle icon="medkit" title={t("clientDetail.careProfile")} />
            <View style={styles.careCard}>
              {!!c.medications && (
                <View style={styles.careBlock}>
                  <Text style={styles.careLabel}>{t("clientDetail.medications")}</Text>
                  <Text style={styles.careBody}>{c.medications}</Text>
                </View>
              )}
              {!!c.behaviours && (
                <View style={styles.careBlock}>
                  <Text style={styles.careLabel}>{t("clientDetail.behaviours")}</Text>
                  <Text style={styles.careBody}>{c.behaviours}</Text>
                </View>
              )}
              {(c.care_sections || []).map((s: any, i: number) => (
                (s.title || s.text) ? (
                  <View key={i} style={styles.careBlock} testID={`care-section-${i}`}>
                    <Text style={styles.careLabel}>{(s.title || "").toUpperCase()}</Text>
                    {!!s.text && <Text style={styles.careBody}>{s.text}</Text>}
                  </View>
                ) : null
              ))}
            </View>
          </>
        )}

        {/* Notes */}
        <SectionTitle icon="document-text" title={t("clientDetail.importantNotes")} />
        <TextInput
          testID="client-notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={t("clientDetail.notesPlaceholder")}
          placeholderTextColor={colors.muted}
          style={styles.notes}
        />
        <Pressable testID="save-notes-btn" style={styles.saveNotes} onPress={saveNotes} disabled={savingNotes}>
          {savingNotes ? <ActivityIndicator size="small" color={colors.brand} /> : <Text style={styles.saveNotesText}>{t("clientDetail.saveNotes")}</Text>}
        </Pressable>

        {/* Reusable activity / routine templates */}
        <View style={styles.sectionHead}>
          <SectionTitle icon="albums" title={t("clientDetail.activityTpls")} inline />
          <Pressable testID="open-activity-tpls" onPress={() => setActivityTplsOpen(true)} style={styles.smallAdd}>
            <Ionicons name="add" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
        <Text style={styles.emptyLine}>{t("clientDetail.activityTplsHint")}</Text>
        {activityTpls.length > 0 ? (
          <View style={{ marginBottom: spacing.sm }}>
            {activityTpls.slice(0, 4).map((tpl: any) => {
              const m = activityMeta(tpl.activity_type);
              return (
                <Pressable
                  key={tpl.id}
                  testID={`activity-tpl-preview-${tpl.id}`}
                  style={styles.rowItem}
                  onPress={() => setActivityTplsOpen(true)}
                >
                  <View style={[styles.invIcon, { backgroundColor: m.color + "22" }]}>
                    <Ionicons name={m.icon as any} size={16} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{tpl.name}</Text>
                    <Text style={styles.rowMeta}>
                      {[m.label, tpl.duration_min ? `${tpl.duration_min} min` : "", tpl.location].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              );
            })}
            {activityTpls.length > 4 && (
              <Pressable onPress={() => setActivityTplsOpen(true)} testID="see-more-activity-tpls">
                <Text style={[styles.emptyLine, { color: colors.brand, fontWeight: weight.bold }]}>{t("clientDetail.seeAllActivityTpls", { count: activityTpls.length })}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Reminders */}
        <View style={styles.sectionHead}>
          <SectionTitle icon="notifications" title={t("clientDetail.reminders")} inline />
          <Pressable testID="add-reminder-btn" onPress={() => setRemModal(true)} style={styles.smallAdd}>
            <Ionicons name="add" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
        {ov.reminders.length === 0 ? (
          <Text style={styles.emptyLine}>{t("clientDetail.noReminders")}</Text>
        ) : ov.reminders.map((r: any) => (
          <Pressable key={r.id} testID={`reminder-${r.id}`} style={styles.rowItem} onPress={() => toggleReminder(r)}>
            <Ionicons name={r.done ? "checkmark-circle" : "alarm-outline"} size={20} color={r.done ? colors.success : colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, r.done && styles.strike]}>{r.title}</Text>
              <Text style={styles.rowMeta}>{r.remind_at ? `${toDMY(r.remind_at)} · ${new Date(r.remind_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}` : ""}</Text>
            </View>
            <Pressable testID={`del-reminder-${r.id}`} onPress={async () => { await api.deleteReminder(r.id); load(); }}>
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </Pressable>
        ))}

        {/* Documents */}
        <View style={styles.sectionHead}>
          <SectionTitle icon="folder" title={t("clientDetail.documents")} inline />
          <Pressable testID="add-doc-btn" onPress={() => setDocModal(true)} style={styles.smallAdd}>
            <Ionicons name="add" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
        <Text style={styles.emptyLine}>{t("clientDetail.docsHint")}</Text>
        {docs.map((d: any) => (
          <Pressable key={d.id} testID={`doc-${d.id}`} style={styles.rowItem} onPress={() => setViewDocItem(d)}>
            <View style={[styles.invIcon, { backgroundColor: (d.extracted_text ? colors.brand : colors.info) + "22" }]}>
              <Ionicons name={d.extracted_text ? "sparkles" : "document-attach"} size={16} color={d.extracted_text ? colors.brand : colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{d.title}</Text>
              <Text style={styles.rowMeta}>{d.type}{d.doc_date ? ` · ${toDMY(d.doc_date)}` : ""}</Text>
            </View>
            {!!(d.file_url || d.extracted_text) && <Ionicons name="eye" size={18} color={colors.brand} />}
            <Pressable testID={`del-doc-${d.id}`} onPress={async () => { await api.deleteClientDoc(d.id); load(); }} style={{ paddingLeft: spacing.sm }}>
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </Pressable>
        ))}

        {/* Tasks / shifts */}
        <SectionTitle icon="calendar" title={t("clientDetail.plannedTasks")} />
        {ov.tasks.length === 0 ? (
          <Text style={styles.emptyLine}>{t("clientDetail.noTasks")}</Text>
        ) : ov.tasks.map((tsk: any) => (
          <View key={tsk.id} style={styles.rowItem} testID={`ctask-${tsk.id}`}>
            <View style={[styles.dot, { backgroundColor: tsk.completed ? colors.success : colors.brand }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, tsk.completed && styles.strike]}>{tsk.title}</Text>
              <Text style={styles.rowMeta}>{tsk.date} · {tsk.time || t("clientDetail.anytime")} · {tsk.type}</Text>
            </View>
          </View>
        ))}

        {/* Invoices */}
        <View style={styles.sectionHead}>
          <SectionTitle icon="document-text" title={t("clientDetail.invoices")} inline />
          <Pressable
            testID="new-client-invoice-btn"
            onPress={() => router.push({ pathname: "/invoice/new", params: { clientId: c.id, clientName: c.name, ndis: c.ndis_number, company: c.company, address: c.address, email: c.email } })}
            style={styles.smallAdd}
          >
            <Ionicons name="add" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
        {ov.invoices.length === 0 ? (
          <Text style={styles.emptyLine}>{t("clientDetail.noInvoices")}</Text>
        ) : (
          <>
            {pending.length > 0 && <Text style={styles.groupLabel}>{t("clientDetail.pending")} · {pending.length}</Text>}
            {pending.map((i: any) => <InvoiceRow key={i.id} inv={i} onPress={() => router.push(`/invoice/${i.id}`)} />)}
            {paid.length > 0 && <Text style={styles.groupLabel}>{t("clientDetail.paid")} · {paid.length}</Text>}
            {paid.map((i: any) => <InvoiceRow key={i.id} inv={i} onPress={() => router.push(`/invoice/${i.id}`)} />)}
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Add reminder modal */}
      <Modal visible={remModal} transparent animationType="slide" onRequestClose={() => setRemModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("clientDetail.newReminder")}</Text>
            <TextInput testID="reminder-title" value={rTitle} onChangeText={setRTitle} placeholder={t("clientDetail.reminderPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.miniLabel}>{t("clientDetail.dateLabel")}</Text>
                <DateInput testID="reminder-date" value={rDate} onChange={setRDate} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>{t("clientDetail.timeLabel")}</Text>
                <TextInput testID="reminder-time" value={rTime} onChangeText={setRTime} placeholder="HH:MM" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            </View>
            {!!permHint && <Text style={styles.permHint}>{permHint}</Text>}
            <Pressable testID="save-reminder-btn" style={styles.primaryBtn} onPress={addReminder} disabled={savingRem}>
              {savingRem ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("clientDetail.setReminder")}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add document modal */}
      <Modal visible={docModal} transparent animationType="slide" onRequestClose={() => setDocModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("clientDetail.addDocument")}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              {[["Service Agreement", "docServiceAgreement"], ["Consent", "docConsent"], ["Plan", "docPlan"], ["Document", "docDocument"]].map(([dt, dk]) => (
                <Pressable key={dt} testID={`doctype-${dt}`} onPress={() => setDocType(dt)} style={[styles.docTypeChip, docType === dt && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                  <Text style={[styles.docTypeText, docType === dt && { color: colors.onBrand }]}>{t(`clientDetail.${dk}`)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput testID="doc-title" value={docTitle} onChangeText={setDocTitle} placeholder={t("clientDetail.docTitlePlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Pressable testID="doc-camera" style={styles.docPhotoBtn} onPress={async () => { const p = await capturePhoto(); if (p) setDocFile(p); }}>
                <Ionicons name="camera" size={18} color={colors.brand} />
                <Text style={styles.docPhotoText}>{t("clientDetail.photo")}</Text>
              </Pressable>
              <Pressable testID="doc-gallery" style={styles.docPhotoBtn} onPress={async () => { const p = await pickPhoto(); if (p) setDocFile(p); }}>
                <Ionicons name="image" size={18} color={colors.brand} />
                <Text style={styles.docPhotoText}>{t("clientDetail.upload")}</Text>
              </Pressable>
              <Pressable testID="doc-ai-scan" style={[styles.docPhotoBtn, { borderColor: colors.brand, borderStyle: "solid" }]} onPress={aiScan} disabled={aiScanBusy}>
                {aiScanBusy ? <ActivityIndicator size="small" color={colors.brand} /> : (<><Ionicons name="sparkles" size={18} color={colors.brand} /><Text style={styles.docPhotoText}>{t("clientDetail.aiScan")}</Text></>)}
              </Pressable>
            </View>
            <Text style={[styles.emptyLine, { paddingVertical: spacing.xs }]}>{t("clientDetail.aiScanHint")}</Text>
            {!!docFile && <Image source={{ uri: `data:image/jpeg;base64,${docFile}` }} style={styles.docPreview} contentFit="cover" />}
            {!!extracted?.full_text && (
              <View style={styles.extractBox}>
                <Text style={styles.extractLabel}>{t("clientDetail.extractedText")}</Text>
                <Text style={styles.extractText} numberOfLines={6}>{extracted.full_text}</Text>
              </View>
            )}
            <Pressable testID="save-doc-btn" style={styles.primaryBtn} onPress={addDoc} disabled={savingDoc}>
              {savingDoc ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("clientDetail.saveDocument")}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View document (image + AI-extracted text) */}
      <Modal visible={!!viewDocItem} transparent animationType="slide" onRequestClose={() => setViewDocItem(null)}>
        <View style={styles.modalWrap}>
          <View style={[styles.sheet, { maxHeight: "88%" }]} testID="doc-view-sheet">
            <View style={styles.handle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
              <Text style={[styles.sheetTitle, { flex: 1, marginBottom: 0 }]} numberOfLines={2}>{viewDocItem?.title}</Text>
              <Pressable testID="close-doc-view" onPress={() => setViewDocItem(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 520 }}>
              <Text style={styles.rowMeta}>{viewDocItem?.type}{viewDocItem?.doc_date ? ` · ${toDMY(viewDocItem.doc_date)}` : ""}</Text>
              {Array.isArray(viewDocItem?.key_parties) && viewDocItem.key_parties.length > 0 && (
                <Text style={[styles.rowMeta, { marginTop: spacing.xs }]}>{t("clientDetail.docKeyParties")}: {viewDocItem.key_parties.join(", ")}</Text>
              )}
              {!!viewDocItem?.file_url && (
                <Image source={{ uri: viewDocItem.file_url }} style={styles.docViewImage} contentFit="contain" />
              )}
              {!!viewDocItem?.extracted_text && (
                <View style={styles.extractBox}>
                  <Text style={styles.extractLabel}>{t("clientDetail.extractedText")}</Text>
                  <Text style={styles.extractText}>{viewDocItem.extracted_text}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Saved notes (from dashboard Today's Notes) */}
      <Modal visible={notesModal} transparent animationType="slide" onRequestClose={() => setNotesModal(false)}>
        <Pressable style={styles.modalWrap} onPress={() => setNotesModal(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
              <Text style={styles.sheetTitle}>{t("clientDetail.savedNotes")}</Text>
              <Pressable testID="close-notes-btn" onPress={() => setNotesModal(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.rowMeta}>{t("clientDetail.savedNotesCopyHint")}</Text>
            {savedNotes.length === 0 ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm }}>
                <Ionicons name="reader-outline" size={26} color={colors.muted} />
                <Text style={styles.emptyLine}>{t("clientDetail.noSavedNotes")}</Text>
                <Text style={styles.rowMeta}>{t("clientDetail.savedNotesHint")}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator>
                {savedNotes.map((n: any) => (
                  <View key={n.id} testID={`saved-note-${n.id}`} style={styles.savedNoteCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
                      <Text style={styles.savedNoteDate}>
                        {toDMY(n.created_at || n.date)}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Pressable
                          testID={`copy-saved-note-${n.id}`}
                          onPress={async () => {
                            await Clipboard.setStringAsync(n.text || "");
                            confirm(t("clientDetail.noteCopied"));
                          }}
                          hitSlop={8}
                          style={styles.copyBtn}
                        >
                          <Ionicons name="copy-outline" size={14} color={colors.brand} />
                          <Text style={styles.copyBtnText}>{t("clientDetail.copy")}</Text>
                        </Pressable>
                        <Pressable testID={`del-saved-note-${n.id}`} onPress={async () => { await api.deleteClientNote(id, n.id); load(); }}>
                          <Ionicons name="trash-outline" size={18} color={colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.savedNoteText} selectable selectionColor={colors.brand + "55"}>{n.text}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ClientFormSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSaved={load}
        initial={c}
      />

      <ActivityTemplatesEditor
        visible={activityTplsOpen}
        clientId={id}
        clientName={c.name}
        onClose={() => { setActivityTplsOpen(false); load(); }}
      />
    </View>
  );
}

function Stat({ label, value, tint }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function SectionTitle({ icon, title, inline }: any) {
  return (
    <View style={[styles.sectionTitleRow, !inline && { marginTop: spacing.xl }]}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}
function InvoiceRow({ inv, onPress }: any) {
  const paid = inv.status === "paid";
  return (
    <Pressable testID={`cinv-${inv.id}`} style={styles.rowItem} onPress={onPress}>
      <View style={[styles.invIcon, { backgroundColor: (paid ? colors.success : colors.warning) + "22" }]}>
        <Ionicons name={paid ? "checkmark" : "time"} size={16} color={paid ? colors.success : colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{inv.invoice_number}</Text>
        <Text style={styles.rowMeta}>{toDMY(inv.issue_date)}</Text>
      </View>
      <Text style={styles.invTotal}>{money(inv.total)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtnSmall: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  careCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  careBlock: { gap: spacing.xs },
  careLabel: { color: colors.brand, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.5 },
  careBody: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20 },
  profile: { alignItems: "center", gap: spacing.xs },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarText: { fontSize: 26, fontWeight: weight.heavy },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: weight.heavy, marginTop: spacing.sm },
  ndis: { color: colors.muted, fontSize: 14 },
  contactRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  contactBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  contactText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  statCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  budgetCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  budgetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  budgetTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  budgetPct: { fontSize: 13, fontWeight: weight.heavy },
  budgetBarTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  budgetBarFill: { height: 10, borderRadius: 5 },
  budgetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  budgetMeta: { color: colors.muted, fontSize: 12 },
  budgetRemain: { color: colors.onSurface, fontSize: 13, fontWeight: weight.heavy },
  budgetEmpty: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  budgetEmptyText: { color: colors.muted, fontSize: 13, flex: 1 },
  statValue: { fontSize: 16, fontWeight: weight.heavy },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl },
  smallAdd: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  notes: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, minHeight: 90, textAlignVertical: "top" },
  saveNotes: { alignSelf: "flex-end", paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  saveNotesText: { color: colors.brand, fontWeight: weight.bold },
  emptyLine: { color: colors.muted, fontSize: 13, paddingVertical: spacing.sm },
  rowItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  strike: { textDecorationLine: "line-through", color: colors.muted },
  dot: { width: 10, height: 10, borderRadius: 5 },
  invIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  invTotal: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  groupLabel: { color: colors.muted, fontSize: 11, fontWeight: weight.bold, letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.sm },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginBottom: spacing.xs },
  permHint: { color: colors.warning, fontSize: 12, marginBottom: spacing.sm },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  docTypeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  docTypeText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  docPhotoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, borderStyle: "dashed", marginTop: spacing.xs },
  docPhotoText: { color: colors.brand, fontWeight: weight.bold },
  docPreview: { width: "100%", height: 140, borderRadius: radius.md, marginTop: spacing.md },
  docViewImage: { width: "100%", height: 260, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: colors.surfaceTertiary },
  extractBox: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  extractLabel: { color: colors.brand, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.8, marginBottom: spacing.xs },
  extractText: { color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 19 },
  notesBadge: { position: "absolute", top: 4, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  notesBadgeText: { color: colors.onBrand, fontSize: 10, fontWeight: weight.heavy },
  sheetSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  savedNoteCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  savedNoteDate: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  savedNoteText: { color: colors.onSurface, fontSize: 14, lineHeight: 20 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand + "44" },
  copyBtnText: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy },
});
