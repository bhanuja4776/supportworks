import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, money } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useCelebration, useConfirm } from "@/src/components/Celebration";
import { confirmAction } from "@/src/utils/confirm";
import { ShiftTemplateEditor } from "@/src/components/ShiftTemplateEditor";
import { TripPlan } from "@/src/components/TripPlan";
import { typeMeta as activityMeta } from "@/src/components/ActivityTemplatesEditor";
import { DateInput } from "@/src/components/DateInput";
import { formatTime24h } from "@/src/utils/time";
import { useTranslation } from "react-i18next";

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const toDMY = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export default function Shift() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const celebrate = useCelebration();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [planned, setPlanned] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [schedDate, setSchedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selTemplate, setSelTemplate] = useState<any>(null);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<any>(null);
  const [plannedActivities, setPlannedActivities] = useState<any[]>([]);
  const [activityDetail, setActivityDetail] = useState<any>(null);
  // Past (ended) shifts — kept for 7 years for Australian business record retention.
  const [pastShifts, setPastShifts] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  // ---- Start/End shift confirmation sheets (Fix #4) ----
  // Users tap Start/End and confirm the date + times on a lightweight sheet
  // instead of the action firing immediately. End-shift also offers a big
  // "Generate invoice" button that jumps straight to the shift's existing draft.
  const [startSheet, setStartSheet] = useState(false);
  const [endSheet, setEndSheet] = useState(false);
  const [confStartDate, setConfStartDate] = useState("");
  const [confStartTime, setConfStartTime] = useState("");
  const [confEndTime, setConfEndTime] = useState("");

  const load = useCallback(async () => {
    try {
      const [as, cl, sh, tpls] = await Promise.all([
        api.activeShift(), api.listClients(), api.listShifts(true), // include_ended=true so records stay accessible
        api.listShiftTemplates().catch(() => []),
      ]);
      setActive(as.shift);
      setInvoices(as.invoices || []);
      setReceipts(as.receipts || []);
      setActiveTemplate(as.template || null);
      setPlannedActivities(Array.isArray(as.planned_activities) ? as.planned_activities : []);
      setClients(cl);
      const list = Array.isArray(sh) ? sh : [];
      setPlanned(list.filter((s: any) => s.status === "planned"));
      // Ended shifts: sort newest first (by ended_at || scheduled_for || created_at desc).
      const ended = list.filter((s: any) => s.status === "ended");
      ended.sort((a: any, b: any) => (b.ended_at || b.scheduled_for || b.created_at || "").localeCompare(a.ended_at || a.scheduled_for || a.created_at || ""));
      setPastShifts(ended);
      setTemplates(Array.isArray(tpls) ? tpls : []);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const canGo = selected.length > 0 || !!selTemplate;

  // ----- Start shift confirmation sheet -----
  // Open the sheet with sensible defaults (now) and let the user tweak
  // start time before actually starting.
  const openStartSheet = () => {
    if (!canGo) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setConfStartDate(now.toISOString().slice(0, 10));
    // Prefer the picked template's start time if available (matches real day plan).
    setConfStartTime(selTemplate?.start_time || `${hh}:${mm}`);
    setConfEndTime(selTemplate?.end_time || "");
    setStartSheet(true);
  };

  const startNow = async () => {
    if (!canGo) return;
    setStartSheet(false);
    setBusy(true);
    try {
      // Compose ISO for started_at from confirmed date + time.
      const startedIso = confStartDate && confStartTime
        ? new Date(`${confStartDate}T${confStartTime}:00`).toISOString()
        : undefined;
      await api.startShift(selected, selTemplate?.id || "", {
        started_at: startedIso || undefined,
        start_time: confStartTime || undefined,
        end_time: confEndTime || undefined,
      });
      celebrate(t("shift.started"));
      setSelected([]); setSchedDate(""); setSelTemplate(null);
      load();
    } finally { setBusy(false); }
  };

  const planShift = async () => {
    if (!canGo) return;
    setBusy(true);
    try {
      // Default to today for one-tap flow; users can attach the saved shift to
      // any other date from Planner → Attach saved shift.
      const dateForPlanner = schedDate || new Date().toISOString().slice(0, 10);
      await api.planShift(selected, dateForPlanner, selTemplate?.id || "");
      celebrate(t("shift.planned"), { sound: true });
      setSelected([]); setSchedDate(""); setSelTemplate(null);
      load();
    } finally { setBusy(false); }
  };

  const activate = async (id: string) => {
    setBusy(true);
    try { await api.activateShift(id); celebrate(t("shift.activated")); load(); } finally { setBusy(false); }
  };

  const cancelPlan = (id: string) =>
    confirmAction({
      title: t("shift.cancelPlanTitle"),
      message: t("shift.cancelPlanMsg"),
      confirmText: t("shift.confirmCancel"),
      cancelText: t("shift.keepShift"),
      destructive: true,
      onConfirm: async () => { await api.deleteShift(id).catch(() => {}); confirm(t("shift.cancelledShift")); load(); },
    });

  // ----- End shift confirmation sheet -----
  // Opens the review sheet with prefilled start/end times from the active shift,
  // so users can correct them before confirming. A big "Generate invoice"
  // button then routes to the existing shift draft — the seamless one-tap flow.
  const openEndSheet = () => {
    if (!active) return;
    // Default start time = shift.start_time (from template) OR extract HH:MM from started_at.
    let start = active.start_time || "";
    if (!start && active.started_at) {
      try {
        const d = new Date(active.started_at);
        start = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      } catch {}
    }
    // Default end time = shift.end_time OR now.
    let end = active.end_time || "";
    if (!end) {
      const now = new Date();
      end = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    setConfStartTime(start);
    setConfEndTime(end);
    setEndSheet(true);
  };

  const commitEnd = async (opts: { goToInvoice?: boolean } = {}) => {
    if (!active) return;
    setEndSheet(false);
    setBusy(true);
    try {
      await api.endShift(active.id, {
        ended_at: new Date().toISOString(),
        start_time: confStartTime || undefined,
        end_time: confEndTime || undefined,
      });
      celebrate(t("shift.ended"));
      // Seamless invoice hand-off: jump straight to the shift's first draft.
      // Reuses the draft that was created when the shift started (no new invoice).
      if (opts.goToInvoice) {
        const inv = invoices[0];
        if (inv?.id) {
          router.push(`/invoice/${inv.id}` as any);
        } else {
          // Fallback — no draft was generated (unusual).
          router.push("/invoice/new" as any);
        }
      }
      load();
    } finally { setBusy(false); }
  };

  // (retired: legacy endShift used to fire directly. Replaced by openEndSheet/commitEnd.)

  return (
    <View style={styles.container} testID="shift-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{active ? t("shift.activeShift") : t("shift.shiftsTitle")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : active ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View style={styles.liveBanner}>
            <View style={styles.pulse} />
            <Text style={styles.liveText}>{t("shift.onShiftSince", { time: new Date(active.started_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) })}</Text>
            {!!active.start_time && !!active.end_time && (
              <Text style={styles.timesChip}>{active.start_time} – {active.end_time}</Text>
            )}
          </View>

          {activeTemplate?.trip_stops?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("shift.tripPlan")}</Text>
              <TripPlan stops={activeTemplate.trip_stops} />
            </>
          )}

          {/* Planned routines & activities — glanceable summary, tap for detail. */}
          {plannedActivities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("shift.plannedActivities")}</Text>
              <Text style={styles.hint}>{t("shift.plannedActivitiesHint")}</Text>
              {plannedActivities.map((a: any) => {
                const m = a.activity_template_id ? activityMeta(a.activity_type || "activity") : { label: t("shift.plan"), icon: "list", color: colors.info };
                const timeLabel = a.time ? (a.duration_min ? `${a.time} · ${a.duration_min} min` : a.time) : (a.duration_min ? `${a.duration_min} min` : t("shift.anytime"));
                return (
                  <Pressable
                    key={a.id}
                    testID={`planned-activity-${a.id}`}
                    style={[styles.actRow, a.completed && { opacity: 0.55 }]}
                    onPress={() => setActivityDetail(a)}
                  >
                    <View style={[styles.actIcon, { backgroundColor: m.color + "22" }]}>
                      <Ionicons name={m.icon as any} size={16} color={m.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, a.completed && { textDecorationLine: "line-through" }]} numberOfLines={1}>{a.title}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[timeLabel, m.label, a.location].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                );
              })}
            </>
          )}

          <Text style={styles.sectionTitle}>{t("shift.draftInvoices")}</Text>
          <Text style={styles.hint}>{t("shift.draftHint")}</Text>
          {invoices.map((i) => (
            <Pressable key={i.id} testID={`draft-${i.id}`} style={styles.row} onPress={() => router.push(`/invoice/${i.id}`)}>
              <View style={[styles.badge, { backgroundColor: colors.info + "22" }]}>
                <Text style={[styles.badgeText, { color: colors.info }]}>{t("shift.draft")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{i.client_name || t("shift.client")}</Text>
                <Text style={styles.rowMeta}>{i.invoice_number} · {t("shift.items", { count: i.items?.length || 0 })}</Text>
              </View>
              <Text style={styles.rowAmount}>{money(i.total)}</Text>
            </Pressable>
          ))}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t("shift.shiftReceipts")}</Text>
            <Pressable testID="shift-add-receipt" onPress={() => router.push("/(tabs)/scan")} style={styles.smallAdd}>
              <Ionicons name="camera" size={16} color={colors.onBrand} />
              <Text style={styles.smallAddText}>{t("shift.scan")}</Text>
            </Pressable>
          </View>
          {receipts.length === 0 ? (
            <Text style={styles.hint}>{t("shift.noReceipts")}</Text>
          ) : receipts.map((r) => (
            <View key={r.id} style={styles.row} testID={`shiftrec-${r.id}`}>
              <Ionicons name="receipt" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.merchant || t("shift.receipt")}</Text>
                <Text style={styles.rowMeta}>{r.category}</Text>
              </View>
              <Text style={styles.rowAmount}>{money(r.total)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          {/* Planned shifts */}
          {planned.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("shift.plannedShifts")}</Text>
              {planned.map((s) => (
                <View key={s.id} style={styles.plannedCard} testID={`planned-${s.id}`}>
                  <View style={styles.plannedTop}>
                    <View style={styles.calChip}>
                      <Ionicons name="calendar" size={16} color={colors.brand} />
                      <Text style={styles.calChipText}>{s.scheduled_for ? toDMY(s.scheduled_for) : t("shift.noDate")}</Text>
                    </View>
                    <Pressable testID={`cancel-plan-${s.id}`} onPress={() => cancelPlan(s.id)} hitSlop={8}>
                      <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                    </Pressable>
                  </View>
                  <Text style={styles.plannedMeta}>{t("shift.participantsCount", { count: s.invoice_count || 0, amount: money(s.total || 0) })}</Text>
                  <Pressable testID={`activate-${s.id}`} style={styles.activateBtn} onPress={() => activate(s.id)} disabled={busy}>
                    <Ionicons name="play-circle" size={18} color={colors.onBrand} />
                    <Text style={styles.activateText}>{t("shift.activate")}</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {/* Past shifts — kept for 7 years for Australian business record compliance. */}
          {pastShifts.length > 0 && (
            <>
              <Pressable
                testID="toggle-shift-history"
                style={styles.historyHead}
                onPress={() => setHistoryOpen((v) => !v)}
              >
                <Ionicons name="archive" size={16} color={colors.brand} />
                <Text style={styles.historyHeadText}>
                  {t("shift.pastShifts", { count: pastShifts.length })}
                </Text>
                <Ionicons name={historyOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.brand} />
              </Pressable>
              {historyOpen && (
                <>
                  <Text style={styles.hint}>{t("shift.pastShiftsHint")}</Text>
                  {pastShifts.slice(0, 30).map((s) => (
                    <View key={s.id} style={styles.pastCard} testID={`past-shift-${s.id}`}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Ionicons name="checkmark-done-circle" size={18} color={colors.success} />
                        <Text style={styles.pastDate}>{toDMY(s.ended_at || s.scheduled_for || s.created_at || "")}</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.pastAmount}>{money(s.total || 0)}</Text>
                        {/* Deletion for a past shift that didn't happen or was recorded by mistake.
                            Backend already prevents wiping sent/paid invoices via cascade rules. */}
                        <Pressable
                          testID={`del-past-shift-${s.id}`}
                          hitSlop={8}
                          onPress={() => confirmAction({
                            title: t("shift.deletePastTitle"),
                            message: t("shift.deletePastMsg", { count: s.invoice_count || 0 }),
                            confirmText: t("shift.delete"),
                            destructive: true,
                            onConfirm: async () => {
                              try { await api.deleteShift(s.id); confirm(t("shift.deletedToast")); load(); }
                              catch { /* offline queue handles retry */ }
                            },
                          })}
                          style={styles.pastDelBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </Pressable>
                      </View>
                      <Text style={styles.pastMeta}>
                        {t("shift.pastMeta", { count: s.invoice_count || 0 })}
                      </Text>
                    </View>
                  ))}
                  {pastShifts.length > 30 && (
                    <Text style={styles.hint}>{t("shift.pastShiftsMore", { count: pastShifts.length - 30 })}</Text>
                  )}
                </>
              )}
            </>
          )}

          {/* Shift templates */}
          <View style={styles.sectionRowTight}>
            <Text style={[styles.sectionTitle, { marginTop: planned.length > 0 ? spacing.lg : 0 }]}>{t("shift.templates")}</Text>
            <Pressable testID="new-template-btn" onPress={() => { setEditTpl(null); setEditorOpen(true); }} style={styles.smallAdd}>
              <Ionicons name="add" size={16} color={colors.onBrand} />
              <Text style={styles.smallAddText}>{t("shift.newTemplate")}</Text>
            </Pressable>
          </View>
          {templates.length === 0 ? (
            <Text style={styles.hint}>{t("shift.noTemplates")}</Text>
          ) : (
            <>
              <Text style={styles.hint}>{t("shift.templatesHint")}</Text>
              {templates.map((tpl) => {
                const on = selTemplate?.id === tpl.id;
                return (
                  <Pressable key={tpl.id} testID={`template-${tpl.id}`} style={[styles.tplCard, on && styles.tplCardOn]} onPress={() => setSelTemplate(on ? null : tpl)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{tpl.name}</Text>
                      <Text style={styles.rowMeta}>
                        {[tpl.client_name, tpl.start_time && tpl.end_time ? `${tpl.start_time}–${tpl.end_time}` : "", t("shift.tasksCodes", { tasks: (tpl.routine_tasks || []).length, codes: (tpl.items || []).length })].filter(Boolean).join(" · ")}
                      </Text>
                      {tpl.preview_total > 0 && <Text style={styles.tplTotal}>{money(tpl.preview_total)}</Text>}
                    </View>
                    <Pressable testID={`template-edit-${tpl.id}`} hitSlop={8} onPress={() => { setEditTpl(tpl); setEditorOpen(true); }} style={styles.editIcon}>
                      <Ionicons name="pencil" size={16} color={colors.muted} />
                    </Pressable>
                    <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? colors.brand : colors.muted} />
                  </Pressable>
                );
              })}
            </>
          )}

          {/* Live preview of the selected template */}
          {selTemplate && (
            <View style={styles.previewCard} testID="template-preview">
              <View style={styles.previewHead}>
                <Ionicons name="eye" size={16} color={colors.brand} />
                <Text style={styles.previewTitle}>{t("shift.preview")}</Text>
                <Pressable testID="clear-template" onPress={() => setSelTemplate(null)} hitSlop={8}>
                  <Text style={styles.clearText}>{t("shift.clearSelection")}</Text>
                </Pressable>
              </View>
              {!!selTemplate.client_name && (
                <Text style={styles.previewLine}><Text style={styles.previewLabel}>{t("shift.participant")}: </Text>{selTemplate.client_name}</Text>
              )}
              {!!selTemplate.start_time && (
                <Text style={styles.previewLine}><Text style={styles.previewLabel}>{t("shift.times")}: </Text>{selTemplate.start_time} – {selTemplate.end_time}</Text>
              )}
              {(selTemplate.routine_tasks || []).length > 0 && (
                <>
                  <Text style={styles.previewLabel}>{t("shift.routineTasks")}</Text>
                  {selTemplate.routine_tasks.map((task: string, i: number) => (
                    <Text key={i} style={styles.previewTask}>• {task}</Text>
                  ))}
                </>
              )}
              {(selTemplate.items || []).length > 0 && (
                <>
                  <Text style={styles.previewLabel}>{t("shift.billing")}</Text>
                  {selTemplate.items.map((it: any, i: number) => (
                    <View key={i} style={styles.previewItem}>
                      <Text style={styles.previewTask} numberOfLines={1}>{it.ndis_code || it.description}</Text>
                      <Text style={styles.previewAmt}>{it.quantity} × {money(it.rate)}</Text>
                    </View>
                  ))}
                  <Text style={styles.previewTotal}>{t("shift.invoiceTotal", { amount: money(selTemplate.preview_total || 0) })}</Text>
                </>
              )}
              {(selTemplate.trip_stops || []).length > 0 && (
                <>
                  <Text style={styles.previewLabel}>{t("shift.tripPlan")}</Text>
                  <TripPlan stops={selTemplate.trip_stops} />
                </>
              )}
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{selTemplate ? t("shift.orQuickStart") : t("shift.selectParticipants")}</Text>
          <Text style={styles.hint}>{t("shift.planHint")}</Text>
          {clients.length === 0 && templates.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>{t("shift.addClientsFirst")}</Text>
            </View>
          )}
          {clients.map((c) => {
            const on = selected.includes(c.id);
            return (
              <Pressable key={c.id} testID={`shiftclient-${c.id}`} style={[styles.clientRow, on && styles.clientRowOn]} onPress={() => toggle(c.id)}>
                <View style={[styles.avatar, { backgroundColor: (c.color || colors.brand) + "22", borderColor: c.color || colors.brand }]}>
                  <Text style={[styles.avatarText, { color: c.color || colors.brand }]}>{initials(c.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowMeta}>{c.ndis_number ? t("shift.ndisNum", { number: c.ndis_number }) : t("shift.noNdis")}</Text>
                </View>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? colors.brand : colors.muted} />
              </Pressable>
            );
          })}

          {/* Schedule date removed — one-tap "Save to planner" defaults to today.
              Users can move it to any date later from Planner → Attach saved shift. */}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {active ? (
          <Pressable testID="end-shift-btn" style={[styles.cta, { backgroundColor: colors.error }]} onPress={openEndSheet} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (<><Ionicons name="stop-circle" size={20} color="#fff" /><Text style={[styles.ctaText, { color: "#fff" }]}>{t("shift.endShift")}</Text></>)}
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable testID="plan-shift-btn" style={[styles.cta, styles.ctaGhost, { flex: 1 }, !canGo && styles.ctaDisabled]} onPress={planShift} disabled={busy || !canGo}>
              {busy ? <ActivityIndicator color={colors.brand} /> : (<><Ionicons name="calendar" size={18} color={colors.brand} /><Text style={styles.ctaGhostText} numberOfLines={1}>{t("shift.saveToPlanner")}</Text></>)}
            </Pressable>
            <Pressable testID="start-shift-btn" style={[styles.cta, { flex: 1.4 }, !canGo && styles.ctaDisabled]} onPress={openStartSheet} disabled={busy || !canGo}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="play-circle" size={20} color={colors.onBrand} /><Text style={styles.ctaText} numberOfLines={1}>{selTemplate ? t("shift.startWithTemplate", { name: selTemplate.name }) : t("shift.startNow", { count: selected.length })}</Text></>)}
            </Pressable>
          </View>
        )}
      </View>

      <ShiftTemplateEditor
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setSelTemplate(null); confirm(t("shift.templateSaved")); load(); }}
        initial={editTpl}
        clients={clients}
      />

      {/* Planned activity detail modal */}
      <Modal visible={!!activityDetail} transparent animationType="slide" onRequestClose={() => setActivityDetail(null)}>
        <Pressable style={styles.modalWrap} onPress={() => setActivityDetail(null)}>
          <Pressable style={styles.detailSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            {(() => {
              const a = activityDetail;
              if (!a) return null;
              const m = a.activity_template_id ? activityMeta(a.activity_type || "activity") : { label: t("shift.plan"), icon: "list", color: colors.info };
              return (
                <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 520 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
                    <View style={[styles.actIcon, { backgroundColor: m.color + "22", width: 40, height: 40, borderRadius: 20 }]}>
                      <Ionicons name={m.icon as any} size={20} color={m.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailTitle}>{a.title}</Text>
                      <Text style={styles.rowMeta}>{m.label}{a.time ? ` · ${a.time}` : ""}</Text>
                    </View>
                    <Pressable onPress={() => setActivityDetail(null)} hitSlop={8} testID="close-activity-detail">
                      <Ionicons name="close" size={22} color={colors.muted} />
                    </Pressable>
                  </View>
                  <View style={styles.detailChips}>
                    {!!a.duration_min && (
                      <View style={styles.detailChip}>
                        <Ionicons name="time-outline" size={13} color={colors.brand} />
                        <Text style={styles.detailChipText}>{t("shift.durationLbl", { min: a.duration_min })}</Text>
                      </View>
                    )}
                    {!!a.location && (
                      <View style={styles.detailChip}>
                        <Ionicons name="location" size={13} color={colors.brand} />
                        <Text style={styles.detailChipText}>{a.location}</Text>
                      </View>
                    )}
                    {!!a.distance_km && (
                      <View style={styles.detailChip}>
                        <Ionicons name="car" size={13} color={colors.brand} />
                        <Text style={styles.detailChipText}>{t("shift.distanceLbl", { km: a.distance_km })}</Text>
                      </View>
                    )}
                  </View>
                  {!!a.notes && (
                    <>
                      <Text style={styles.detailLabel}>{t("shift.notesLbl")}</Text>
                      <Text style={styles.detailBody} selectable selectionColor={colors.brand + "55"}>{a.notes}</Text>
                    </>
                  )}
                  <Pressable
                    testID="toggle-activity-complete"
                    style={[styles.markBtn, a.completed && { backgroundColor: colors.surfaceTertiary }]}
                    onPress={async () => {
                      await api.updateTask(a.id, { completed: !a.completed });
                      setActivityDetail({ ...a, completed: !a.completed });
                      load();
                    }}
                  >
                    <Ionicons name={a.completed ? "arrow-undo" : "checkmark-done"} size={16} color={a.completed ? colors.onSurface : colors.onBrand} />
                    <Text style={[styles.markText, a.completed && { color: colors.onSurface }]}>
                      {a.completed ? t("shift.markIncomplete") : t("shift.markComplete")}
                    </Text>
                  </Pressable>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Confirm Start Shift sheet (Fix #4) ---- */}
      {/* One-tap flow: user reviews date + start/end times → single "Confirm & Start"
          button. Prevents accidental starts and preserves the actual clock-in time
          for accurate invoicing. */}
      <Modal visible={startSheet} transparent animationType="slide" onRequestClose={() => setStartSheet(false)}>
        <View style={styles.confWrap}>
          <View style={styles.confSheet} testID="start-shift-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.confTitle}>{t("shift.confirmStartTitle")}</Text>
            <Text style={styles.confSub}>{t("shift.confirmStartSub")}</Text>
            <Text style={styles.confLabel}>{t("shift.date")}</Text>
            <DateInput testID="conf-start-date" value={confStartDate} onChange={setConfStartDate} style={styles.confInput} />
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.confLabel}>{t("shift.startTime")}</Text>
                <TextInput
                  testID="conf-start-time"
                  value={confStartTime}
                  onChangeText={(v) => setConfStartTime(formatTime24h(v))}
                  placeholder="09:00"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={styles.confInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confLabel}>{t("shift.endTime")}</Text>
                <TextInput
                  testID="conf-start-end-time"
                  value={confEndTime}
                  onChangeText={(v) => setConfEndTime(formatTime24h(v))}
                  placeholder="17:00"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={styles.confInput}
                />
              </View>
            </View>
            <Text style={styles.confHint}>{t("shift.endTimeHint")}</Text>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <Pressable testID="conf-start-cancel" onPress={() => setStartSheet(false)} style={[styles.confBtn, styles.confBtnGhost]}>
                <Text style={styles.confBtnGhostText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable testID="conf-start-confirm" onPress={startNow} style={[styles.confBtn, styles.confBtnPrimary]} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.onBrand} /> : (<>
                  <Ionicons name="play-circle" size={18} color={colors.onBrand} />
                  <Text style={styles.confBtnPrimaryText}>  {t("shift.confirmStartCta")}</Text>
                </>)}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---- Confirm End Shift sheet (Fix #4) ----
          Users can adjust the recorded start/end times before finalising, and
          land on the shift's existing draft invoice with one tap ("Confirm & Invoice"). */}
      <Modal visible={endSheet} transparent animationType="slide" onRequestClose={() => setEndSheet(false)}>
        <View style={styles.confWrap}>
          <View style={styles.confSheet} testID="end-shift-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.confTitle}>{t("shift.confirmEndTitle")}</Text>
            <Text style={styles.confSub}>{t("shift.confirmEndSub")}</Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.confLabel}>{t("shift.startTime")}</Text>
                <TextInput
                  testID="conf-end-start-time"
                  value={confStartTime}
                  onChangeText={(v) => setConfStartTime(formatTime24h(v))}
                  placeholder="09:00"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={styles.confInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confLabel}>{t("shift.endTime")}</Text>
                <TextInput
                  testID="conf-end-end-time"
                  value={confEndTime}
                  onChangeText={(v) => setConfEndTime(formatTime24h(v))}
                  placeholder="17:00"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={styles.confInput}
                />
              </View>
            </View>
            {invoices.length > 0 && invoices[0]?.client_name && (
              <Text style={styles.confInvHint}>{t("shift.confirmEndInvHint", { number: invoices[0].invoice_number, client: invoices[0].client_name })}</Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <Pressable testID="conf-end-cancel" onPress={() => setEndSheet(false)} style={[styles.confBtn, styles.confBtnGhost]}>
                <Text style={styles.confBtnGhostText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable testID="conf-end-plain" onPress={() => commitEnd({ goToInvoice: false })} style={[styles.confBtn, styles.confBtnGhost]} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.brand} /> : (
                  <Text style={styles.confBtnGhostText}>{t("shift.confirmEndOnly")}</Text>
                )}
              </Pressable>
              <Pressable testID="conf-end-to-invoice" onPress={() => commitEnd({ goToInvoice: true })} style={[styles.confBtn, styles.confBtnPrimary]} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.onBrand} /> : (<>
                  <Ionicons name="document-text" size={18} color={colors.onBrand} />
                  <Text style={styles.confBtnPrimaryText}>  {t("shift.confirmEndCta")}</Text>
                </>)}
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
  liveBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.success + "1A", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.success + "55", marginBottom: spacing.lg },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  liveText: { color: colors.success, fontWeight: weight.bold, flex: 1 },
  timesChip: { color: colors.success, fontWeight: weight.heavy, fontSize: 13 },
  sectionRowTight: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tplCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  tplCardOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  tplTotal: { color: colors.success, fontSize: 13, fontWeight: weight.heavy, marginTop: 2 },
  editIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  previewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.brand + "66", marginTop: spacing.xs, gap: spacing.xs },
  previewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  previewTitle: { flex: 1, color: colors.brand, fontSize: 14, fontWeight: weight.heavy },
  clearText: { color: colors.muted, fontSize: 12, fontWeight: weight.bold },
  previewLine: { color: colors.onSurface, fontSize: 13 },
  previewLabel: { color: colors.brand, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.4, marginTop: spacing.xs },
  previewTask: { color: colors.onSurfaceTertiary, fontSize: 13, flex: 1 },
  previewItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  previewAmt: { color: colors.onSurface, fontSize: 12, fontWeight: weight.bold },
  previewTotal: { color: colors.success, fontSize: 13, fontWeight: weight.heavy, textAlign: "right", marginTop: spacing.xs },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold, marginTop: spacing.md, marginBottom: spacing.xs },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  smallAdd: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  smallAddText: { color: colors.onBrand, fontWeight: weight.bold, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: weight.heavy, letterSpacing: 0.5 },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowAmount: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  plannedCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  plannedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  calChipText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  plannedMeta: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  activateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.md },
  activateText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 14 },
  clientRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  clientRowOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  avatarText: { fontSize: 15, fontWeight: weight.heavy },
  dateBlock: { marginTop: spacing.lg },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  empty: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  cta: { height: 56, borderRadius: radius.md, backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ctaGhost: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.brand },
  ctaGhostText: { color: colors.brand, fontWeight: weight.heavy, fontSize: 14 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 16 },
  actRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  actIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  detailSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "80%" },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  detailTitle: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  detailChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  detailChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand + "44" },
  detailChipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  detailLabel: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.sm },
  detailBody: { color: colors.onSurface, fontSize: 14, lineHeight: 20 },
  markBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.lg },
  markText: { color: colors.onBrand, fontWeight: weight.heavy },
  historyHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand + "33" },
  historyHeadText: { flex: 1, color: colors.brand, fontSize: 13, fontWeight: weight.heavy, letterSpacing: 0.4 },
  pastCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  pastDate: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  pastAmount: { color: colors.brand, fontSize: 14, fontWeight: weight.heavy },
  pastDelBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  pastMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  // ---- Start/End Shift confirmation sheets (Fix #4) ----
  confWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  confSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  confTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy },
  confSub: { color: colors.muted, fontSize: 13, marginTop: 2, marginBottom: spacing.md },
  confLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginBottom: spacing.xs, marginTop: spacing.sm },
  confInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  confHint: { color: colors.muted, fontSize: 11, marginTop: spacing.xs, fontStyle: "italic" },
  confInvHint: { color: colors.brand, fontSize: 12, marginTop: spacing.md, textAlign: "center", fontWeight: weight.bold },
  confBtn: { flex: 1, height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: spacing.sm },
  confBtnGhost: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary },
  confBtnGhostText: { color: colors.onSurface, fontWeight: weight.bold, fontSize: 13, textAlign: "center" },
  confBtnPrimary: { backgroundColor: colors.brand, flex: 1.3 },
  confBtnPrimaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 14 },
});
