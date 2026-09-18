import { useCallback, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList, Modal, TextInput, Platform, ActivityIndicator, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api, money } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useCelebration, useConfirm } from "@/src/components/Celebration";
import { scheduleTaskAlarm, cancelTaskAlarm, ensureAlarmPermission } from "@/src/alarms";
import { typeMeta as activityMeta } from "@/src/components/ActivityTemplatesEditor";
import { formatTime24h, minutesBetween, formatDuration } from "@/src/utils/time";

const TYPES = ["shift", "task", "event"];
const TYPE_KEYS: Record<string, string> = { shift: "planner.typeShift", task: "planner.typeTask", event: "planner.typeEvent" };
const TYPE_COLOR: Record<string, string> = { shift: colors.brand, task: colors.info, event: colors.warning };

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday-first
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayWindow() {
  // 7 days back + 21 forward — lets users see past bookings & scroll ahead
  // without needing the Week/Month tabs. Past days stay visible for record keeping.
  const days = [];
  const base = new Date();
  for (let i = -7; i < 21; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function Planner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const celebrate = useCelebration();
  const confirm = useConfirm();
  const days = dayWindow();
  const dayScrollRef = useRef<ScrollView | null>(null);
  const [selected, setSelected] = useState(new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");      // start time (24-hr)
  const [endTime, setEndTime] = useState(""); // end time (24-hr); derives shift duration on save
  const [type, setType] = useState("shift");
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [monthCursor, setMonthCursor] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // "Attach to…" — a planner entry can pull details from a client's activity template,
  // link to the current/upcoming shift, or capture location/duration for trip planning.
  const [clientId, setClientId] = useState("");
  const [activityTemplateId, setActivityTemplateId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [linkedShiftId, setLinkedShiftId] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [distance, setDistance] = useState("");
  const [attachOpen, setAttachOpen] = useState<null | "client" | "activity" | "shift">(null);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);

  const load = useCallback(async () => {
    try { setTasks(await api.listTasks(selected)); } catch {} finally { setLoading(false); }
  }, [selected]);
  const loadAll = useCallback(async () => {
    try { setAllTasks(await api.listTasks()); } catch {}
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    loadAll();
    api.listExpenses().then(setExpenses).catch(() => {});
    api.listClients().then((cs) => setClientsList(cs || [])).catch(() => setClientsList([]));
    api.listShifts().then((sh) => setShiftsList((sh || []).filter((s: any) => s.status === "planned"))).catch(() => setShiftsList([]));
    api.listShiftTemplates().then((tpl) => setTemplateList(tpl || [])).catch(() => setTemplateList([]));
    api.activeShift().then((r) => setActiveShift(r?.shift || null)).catch(() => setActiveShift(null));
  }, [load, loadAll]));

  // When a client is picked in the sheet, load their activity templates for "Attach activity".
  const loadActivitiesForClient = useCallback(async (cid: string) => {
    if (!cid) { setActivityList([]); return; }
    try { setActivityList(await api.listActivityTemplates(cid)); } catch { setActivityList([]); }
  }, []);

  // Finance events (bills due / direct debits / renewals) for the selected day.
  const dayFinance = useMemo(() => {
    const out: any[] = [];
    expenses.forEach((e) => {
      if ((e.due_date || "").slice(0, 10) === selected)
        out.push({ id: `${e.id}-due`, kind: e.direct_debit ? t("planner.directDebit") : t("planner.billDue"), icon: e.direct_debit ? "repeat" : "time-outline", color: colors.warning, name: e.name, cost: e.cost });
      if ((e.renewal_date || "").slice(0, 10) === selected)
        out.push({ id: `${e.id}-ren`, kind: t("planner.renewal"), icon: "refresh", color: colors.info, name: e.name, cost: e.cost });
    });
    return out;
  }, [expenses, selected]);

  const financeDates = useMemo(() => {
    const s = new Set<string>();
    expenses.forEach((e) => { if (e.due_date) s.add(e.due_date.slice(0, 10)); if (e.renewal_date) s.add(e.renewal_date.slice(0, 10)); });
    return s;
  }, [expenses]);

  // Per-day type counts across all tasks — powers the at-a-glance dots & summary.
  const dayCounts = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    allTasks.forEach((tk) => {
      const iso = (tk.date || "").slice(0, 10);
      if (!iso) return;
      const ty = tk.type || "task";
      if (!m[iso]) m[iso] = {};
      m[iso][ty] = (m[iso][ty] || 0) + 1;
    });
    return m;
  }, [allTasks]);

  const selectedCounts = useMemo(
    () => TYPES.map((ty) => ({ type: ty, count: tasks.filter((tk) => tk.type === ty).length })).filter((s) => s.count > 0),
    [tasks],
  );
  const doneCount = tasks.filter((tk) => tk.completed).length;

  const resetAttachments = () => {
    setClientId(""); setActivityTemplateId(""); setActivityType("");
    setLinkedShiftId(""); setDuration(""); setLocation(""); setDistance("");
    setActivityList([]);
  };

  const openCreate = () => {
    setEditing(null); setTitle(""); setTime(""); setEndTime(""); setType("shift");
    resetAttachments();
    setModal(true);
  };
  const openEdit = (task: any) => {
    setEditing(task);
    setTitle(task.title || ""); setTime(task.time || "");
    setEndTime(task.end_time || "");
    setType(task.type || "task");
    setClientId(task.client_id || "");
    setActivityTemplateId(task.activity_template_id || "");
    setActivityType(task.activity_type || "");
    setLinkedShiftId(task.shift_id || "");
    setDuration(task.duration_min ? String(task.duration_min) : "");
    setLocation(task.location || "");
    setDistance(task.distance_km ? String(task.distance_km) : "");
    if (task.client_id) loadActivitiesForClient(task.client_id);
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };

  const applyActivityTemplate = (tpl: any) => {
    setActivityTemplateId(tpl.id);
    setActivityType(tpl.activity_type || "activity");
    if (!title.trim()) setTitle(tpl.name || "");
    if (!duration && tpl.duration_min) setDuration(String(tpl.duration_min));
    if (!location && tpl.location) setLocation(tpl.location);
    if (!distance && tpl.distance_km) setDistance(String(tpl.distance_km));
    setAttachOpen(null);
  };

  const applyClient = (c: any) => {
    setClientId(c.id);
    loadActivitiesForClient(c.id);
    setAttachOpen("activity");
  };

  // Apply a shift TEMPLATE (a reusable blueprint) to the current planner form.
  // Templates are not shifts — they pre-fill title, time range, participant + activity list.
  const applyTemplate = (tpl: any) => {
    if (!title.trim() && tpl.name) setTitle(tpl.name);
    if (!time && tpl.start_time) setTime(tpl.start_time);
    if (!endTime && tpl.end_time) setEndTime(tpl.end_time);
    if (tpl.client_id) {
      setClientId(tpl.client_id);
      loadActivitiesForClient(tpl.client_id);
    }
    setType("shift");
    setAttachOpen(null);
  };

  const saveTask = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Derive shift duration from start/end when the user hasn't manually
      // set it — keeps the 24-hr time range as the source of truth.
      const derivedDuration = time && endTime ? minutesBetween(time, endTime) : 0;
      const attachments = {
        client_id: clientId || "",
        activity_template_id: activityTemplateId || "",
        activity_type: activityType || "",
        shift_id: linkedShiftId || "",
        duration_min: parseInt(duration, 10) || derivedDuration || 0,
        location: location.trim(),
        distance_km: parseFloat(distance) || 0,
      };
      if (editing) {
        await api.updateTask(editing.id, { title, time, end_time: endTime, type, ...attachments });
        if (Platform.OS !== "web") {
          if (time.trim()) {
            const ok = await ensureAlarmPermission();
            if (ok) await scheduleTaskAlarm({ id: editing.id, title, date: (editing.date || selected).slice(0, 10), time: time.trim() }, t("planner.alarmBody", { time: time.trim() }));
          } else {
            cancelTaskAlarm(editing.id);
          }
        }
        confirm(t("planner.planUpdated"));
      } else {
        const created = await api.createTask({ title, time, end_time: endTime, type, date: selected, ...attachments });
        if (Platform.OS !== "web" && time.trim() && created?.id) {
          const ok = await ensureAlarmPermission();
          if (ok) await scheduleTaskAlarm({ id: created.id, title, date: selected, time: time.trim() }, t("planner.alarmBody", { time: time.trim() }));
        }
        confirm(t("planner.taskAdded"));
      }
      setTitle(""); setTime(""); setEndTime(""); setType("shift"); setEditing(null);
      resetAttachments();
      setModal(false);
      load(); loadAll();
    } catch (e: any) {
      Alert.alert(t("planner.addError"), e?.message || t("common.somethingWrong"));
    } finally { setSaving(false); }
  };

  const removeTask = async (taskId: string) => {
    await api.deleteTask(taskId);
    cancelTaskAlarm(taskId);
    setModal(false); setEditing(null);
    confirm(t("planner.planDeleted"));
    load(); loadAll();
  };

  const toggle = async (task: any) => {
    await api.updateTask(task.id, { completed: !task.completed });
    if (!task.completed) {
      celebrate(t("planner.taskComplete"), { sound: true });
      cancelTaskAlarm(task.id);
    }
    load(); loadAll();
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const renderWeek = () => {
    const daysW: Date[] = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
    const label = `${daysW[0].getDate()} ${daysW[0].toLocaleDateString("en-AU", { month: "short" })} – ${daysW[6].getDate()} ${daysW[6].toLocaleDateString("en-AU", { month: "short" })}`;
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false} testID="week-view">
        <View style={styles.navRow}>
          <Pressable testID="week-prev" onPress={() => setWeekStart((w) => { const x = new Date(w); x.setDate(x.getDate() - 7); return x; })} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.navLabel}>{label}</Text>
          <Pressable testID="week-next" onPress={() => setWeekStart((w) => { const x = new Date(w); x.setDate(x.getDate() + 7); return x; })} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
          </Pressable>
        </View>
        {daysW.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const dayTasks = allTasks.filter((tk) => (tk.date || "").slice(0, 10) === iso).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
          const c = dayCounts[iso] || {};
          const hasFin = financeDates.has(iso);
          return (
            <Pressable key={iso} testID={`week-day-${iso}`} style={[styles.weekRow, iso === todayIso && { borderColor: colors.brand }]} onPress={() => { setSelected(iso); setView("day"); }}>
              <View style={styles.weekDateCol}>
                <Text style={styles.weekDayName}>{d.toLocaleDateString("en-AU", { weekday: "short" })}</Text>
                <Text style={styles.weekDayNum}>{d.getDate()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {dayTasks.length === 0 && !hasFin ? (
                  <Text style={styles.weekEmpty}>{t("planner.nothingPlanned")}</Text>
                ) : (
                  <>
                    <View style={styles.weekChips}>
                      {TYPES.map((ty) => (c[ty] ? (
                        <View key={ty} style={[styles.summaryChip, { borderColor: TYPE_COLOR[ty] + "66" }]}>
                          <View style={[styles.summaryDot, { backgroundColor: TYPE_COLOR[ty] }]} />
                          <Text style={styles.summaryText}>{c[ty]} {t(TYPE_KEYS[ty])}</Text>
                        </View>
                      ) : null))}
                      {hasFin && (
                        <View style={[styles.summaryChip, { borderColor: colors.warning + "66" }]}>
                          <Ionicons name="cash-outline" size={11} color={colors.warning} />
                          <Text style={styles.summaryText}>{t("planner.moneyOut")}</Text>
                        </View>
                      )}
                    </View>
                    {dayTasks.slice(0, 3).map((tk) => (
                      <Text key={tk.id} numberOfLines={1} style={[styles.weekTask, tk.completed && styles.strike]}>
                        {tk.time ? `${tk.time} · ` : ""}{tk.title}
                      </Text>
                    ))}
                    {dayTasks.length > 3 && <Text style={styles.weekMore}>{t("planner.more", { count: dayTasks.length - 3 })}</Text>}
                  </>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const renderMonth = () => {
    const y = monthCursor.getFullYear();
    const mo = monthCursor.getMonth();
    const firstOffset = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const prefix = `${y}-${String(mo + 1).padStart(2, "0")}`;
    const monthTasks = allTasks.filter((tk) => (tk.date || "").startsWith(prefix));
    const doneM = monthTasks.filter((tk) => tk.completed).length;
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false} testID="month-view">
        <View style={styles.navRow}>
          <Pressable testID="month-prev" onPress={() => setMonthCursor(new Date(y, mo - 1, 1))} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.navLabel}>{monthCursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</Text>
          <Pressable testID="month-next" onPress={() => setMonthCursor(new Date(y, mo + 1, 1))} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.gridHead}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((wd) => (
            <Text key={wd} style={styles.gridHeadText}>{wd}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={i} style={styles.gridCell} />;
            const iso = `${prefix}-${String(day).padStart(2, "0")}`;
            const c = dayCounts[iso] || {};
            const total = TYPES.reduce((s, ty) => s + (c[ty] || 0), 0);
            const isToday = iso === todayIso;
            return (
              <Pressable key={i} testID={`month-day-${iso}`} style={[styles.gridCell, styles.gridCellDay, isToday && { borderColor: colors.brand }]} onPress={() => { setSelected(iso); setView("day"); }}>
                <Text style={[styles.gridNum, isToday && { color: colors.brand }]}>{day}</Text>
                {total > 0 && <View style={styles.gridBadge}><Text style={styles.gridBadgeText}>{total}</Text></View>}
                <View style={styles.gridDots}>
                  {TYPES.map((ty) => (c[ty] ? <View key={ty} style={[styles.typeDot, { backgroundColor: TYPE_COLOR[ty] }]} /> : null))}
                  {financeDates.has(iso) && <View style={[styles.typeDot, { backgroundColor: colors.warning }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.monthSummary} testID="month-summary">
          <Text style={styles.financeHeading}>{t("planner.monthSummary")}</Text>
          <View style={styles.weekChips}>
            {TYPES.map((ty) => {
              const n = monthTasks.filter((tk) => tk.type === ty).length;
              return n > 0 ? (
                <View key={ty} style={[styles.summaryChip, { borderColor: TYPE_COLOR[ty] + "66" }]}>
                  <View style={[styles.summaryDot, { backgroundColor: TYPE_COLOR[ty] }]} />
                  <Text style={styles.summaryText}>{n} {t(TYPE_KEYS[ty])}</Text>
                </View>
              ) : null;
            })}
            {monthTasks.length > 0 ? (
              <View style={[styles.summaryChip, { borderColor: colors.success + "66" }]}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={styles.summaryText}>{t("planner.completedCount", { done: doneM, total: monthTasks.length })}</Text>
              </View>
            ) : (
              <Text style={styles.weekEmpty}>{t("planner.nothingPlanned")}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container} testID="planner-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("planner.title")}</Text>
          <View style={styles.segRow}>
            {(["day", "week", "month"] as const).map((v) => (
              <Pressable
                key={v}
                testID={`view-${v}`}
                onPress={() => {
                  setView(v);
                  if (v === "week") setWeekStart(startOfWeek(new Date(selected)));
                  if (v === "month") { const d = new Date(selected); setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }
                }}
                style={[styles.segBtn, view === v && styles.segOn]}
              >
                <Text style={[styles.segText, view === v && { color: colors.onBrand }]}>{t(`planner.view${v.charAt(0).toUpperCase()}${v.slice(1)}`)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {view === "day" && (
        <ScrollView
          ref={(ref) => { dayScrollRef.current = ref; }}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.lg }}
          onLayout={() => {
            // Jump to today after mount so the 7 past days sit off-screen to the left
            // (they scroll back in with a swipe — no wasted space, still accessible).
            requestAnimationFrame(() => dayScrollRef.current?.scrollTo({ x: 7 * 68, animated: false }));
          }}
        >
          {days.map((d) => {
            const iso = d.toISOString().slice(0, 10);
            const active = iso === selected;
            return (
              <Pressable key={iso} testID={`day-${iso}`} onPress={() => setSelected(iso)} style={[styles.dayCard, active && styles.dayActive]}>
                <Text style={[styles.dayName, active && styles.dayTextActive]}>{d.toLocaleDateString("en-AU", { weekday: "short" })}</Text>
                <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.getDate()}</Text>
                {(() => {
                  const dots: string[] = [];
                  const c = dayCounts[iso];
                  if (c) TYPES.forEach((ty) => { if (c[ty]) dots.push(TYPE_COLOR[ty]); });
                  if (financeDates.has(iso)) dots.push(colors.warning);
                  return dots.length ? (
                    <View style={styles.dotRow}>
                      {dots.slice(0, 4).map((cl, di) => (
                        <View key={di} style={[styles.typeDot, { backgroundColor: active ? colors.onBrand : cl }]} />
                      ))}
                    </View>
                  ) : null;
                })()}
              </Pressable>
            );
          })}
        </ScrollView>
        )}
        {view === "day" && tasks.length > 0 && (
          <View style={styles.summaryRow} testID="planner-summary">
            {selectedCounts.map((s) => (
              <View key={s.type} style={[styles.summaryChip, { borderColor: TYPE_COLOR[s.type] + "66" }]}>
                <View style={[styles.summaryDot, { backgroundColor: TYPE_COLOR[s.type] }]} />
                <Text style={styles.summaryText}>{s.count} {t(TYPE_KEYS[s.type])}</Text>
              </View>
            ))}
            <View style={[styles.summaryChip, { borderColor: colors.success + "66" }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={styles.summaryText}>{t("planner.completedCount", { done: doneCount, total: tasks.length })}</Text>
            </View>
          </View>
        )}
      </View>

      {view === "week" && renderWeek()}
      {view === "month" && renderMonth()}
      {view === "day" && (loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            dayFinance.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="calendar-clear-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyText}>{t("planner.empty")}</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            dayFinance.length > 0 ? (
              <View style={styles.financeBlock} testID="planner-finance">
                <Text style={styles.financeHeading}>{t("planner.moneyOut")}</Text>
                {dayFinance.map((f) => (
                  <View key={f.id} style={styles.financeRow}>
                    <View style={[styles.financeIcon, { backgroundColor: f.color + "22" }]}>
                      <Ionicons name={f.icon as any} size={16} color={f.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.financeName}>{f.name}</Text>
                      <Text style={[styles.financeKind, { color: f.color }]}>{f.kind}</Text>
                    </View>
                    <Text style={styles.financeCost}>{money(f.cost)}</Text>
                  </View>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const aMeta = item.activity_template_id ? activityMeta(item.activity_type || "activity") : null;
            const extras: string[] = [];
            // 24-hour time range: "09:00 – 17:00" with duration when both set.
            const range = item.time && item.end_time ? `${item.time} – ${item.end_time}` : (item.time || "");
            const derivedDur = item.time && item.end_time ? minutesBetween(item.time, item.end_time) : 0;
            const dur = item.duration_min || derivedDur;
            if (dur) extras.push(formatDuration(dur));
            if (item.location) extras.push(item.location);
            return (
              <Pressable style={styles.task} testID={`task-${item.id}`} onPress={() => openEdit(item)}>
                <Pressable testID={`toggle-task-${item.id}`} onPress={() => toggle(item)} hitSlop={8} style={[styles.check, item.completed && styles.checkDone]}>
                  {item.completed && <Ionicons name="checkmark" size={16} color={colors.onSuccess} />}
                </Pressable>
                <View style={[styles.typeBar, { backgroundColor: aMeta?.color || TYPE_COLOR[item.type] || colors.brand }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, item.completed && styles.strike]}>{item.title}</Text>
                  <Text style={styles.taskMeta}>
                    {range || t("planner.anytime")} · {item.type ? (t(TYPE_KEYS[item.type]) || item.type) : ""}
                    {extras.length > 0 ? ` · ${extras.join(" · ")}` : ""}
                  </Text>
                </View>
                {aMeta && <Ionicons name={aMeta.icon as any} size={16} color={aMeta.color} />}
                <Ionicons name="create-outline" size={17} color={colors.muted} />
                <Pressable testID={`del-task-${item.id}`} onPress={async () => { await api.deleteTask(item.id); cancelTaskAlarm(item.id); load(); loadAll(); }} style={{ padding: spacing.sm }}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      ))}

      <Pressable testID="add-task-fab" style={[styles.fab, { bottom: insets.bottom + 78 }]} onPress={openCreate}>
        <Ionicons name="add" size={28} color={colors.onBrand} />
      </Pressable>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={[styles.sheet, { maxHeight: "92%" }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>{editing ? t("planner.editPlan") : t("planner.newPlan")}</Text>
              <TextInput testID="task-title-input" value={title} onChangeText={setTitle} placeholder={t("planner.titlePlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.attachLabel}>{t("planner.shiftHours")}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput
                  testID="task-start-input"
                  value={time}
                  onChangeText={(v) => setTime(formatTime24h(v))}
                  placeholder={t("planner.startPh")}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  testID="task-end-input"
                  value={endTime}
                  onChangeText={(v) => setEndTime(formatTime24h(v))}
                  placeholder={t("planner.endPh")}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
              {time && endTime && minutesBetween(time, endTime) > 0 && (
                <Text style={styles.durationHint} testID="task-duration-hint">
                  {t("planner.shiftDurationHint", { duration: formatDuration(minutesBetween(time, endTime)) })}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                {TYPES.map((ty) => (
                  <Pressable key={ty} testID={`type-${ty}`} onPress={() => setType(ty)} style={[styles.typeChip, type === ty && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                    <Text style={[styles.typeChipText, type === ty && { color: colors.onBrand }]}>{t(TYPE_KEYS[ty])}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Attach to... — surfaces the extra planning power the user asked for. */}
              <Text style={styles.attachLabel}>{t("planner.attachTo")}</Text>
              <View style={styles.attachGrid}>
                <Pressable testID="attach-client" onPress={() => setAttachOpen("client")} style={styles.attachBtn}>
                  <Ionicons name="people" size={16} color={colors.brand} />
                  <Text style={styles.attachText} numberOfLines={1}>
                    {clientId ? (clientsList.find((c) => c.id === clientId)?.name || t("planner.participant")) : t("planner.participant")}
                  </Text>
                </Pressable>
                <Pressable
                  testID="attach-activity"
                  onPress={() => { if (clientId) { loadActivitiesForClient(clientId); setAttachOpen("activity"); } else setAttachOpen("client"); }}
                  style={[styles.attachBtn, !clientId && { opacity: 0.7 }]}
                >
                  <Ionicons name={activityMeta(activityType).icon as any} size={16} color={activityTemplateId ? activityMeta(activityType).color : colors.brand} />
                  <Text style={styles.attachText} numberOfLines={1}>
                    {activityTemplateId ? (activityList.find((a) => a.id === activityTemplateId)?.name || t("planner.activityTpl")) : t("planner.activityTpl")}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.attachGrid}>
                <Pressable
                  testID="attach-current-shift"
                  onPress={() => { if (activeShift?.id) setLinkedShiftId((prev) => prev === activeShift.id ? "" : activeShift.id); }}
                  style={[styles.attachBtn, linkedShiftId === activeShift?.id && activeShift?.id && styles.attachBtnOn]}
                >
                  <Ionicons name="flash" size={16} color={linkedShiftId === activeShift?.id ? colors.onBrand : (activeShift ? colors.success : colors.muted)} />
                  <Text style={[styles.attachText, linkedShiftId === activeShift?.id && { color: colors.onBrand }]} numberOfLines={1}>
                    {activeShift ? t("planner.currentShift") : t("planner.noCurrentShift")}
                  </Text>
                </Pressable>
                <Pressable testID="attach-saved-shift" onPress={() => setAttachOpen("shift")} style={[styles.attachBtn, linkedShiftId && linkedShiftId !== activeShift?.id && styles.attachBtnOn]}>
                  <Ionicons name="calendar" size={16} color={(linkedShiftId && linkedShiftId !== activeShift?.id) ? colors.onBrand : colors.brand} />
                  <Text style={[styles.attachText, (linkedShiftId && linkedShiftId !== activeShift?.id) && { color: colors.onBrand }]} numberOfLines={1}>
                    {linkedShiftId && linkedShiftId !== activeShift?.id ? t("planner.savedShiftPicked") : t("planner.savedOrTemplate")}
                  </Text>
                </Pressable>
              </View>

              {/* Trip planning fields — populated by activity template, editable inline. */}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput testID="task-location" value={location} onChangeText={setLocation} placeholder={t("planner.locationPh")} placeholderTextColor={colors.muted} style={[styles.input, { flex: 1.6 }]} />
                <TextInput testID="task-distance" value={distance} onChangeText={setDistance} placeholder={t("planner.distancePh")} placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} />
              </View>

              <Pressable testID="save-task-btn" style={styles.primaryBtn} onPress={saveTask} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>{editing ? t("planner.saveChanges") : selected === new Date().toISOString().slice(0,10) ? t("planner.addToToday") : t("planner.addToPlanner")}</Text>}
              </Pressable>
              {!!editing && (
                <Pressable testID="delete-task-modal-btn" style={styles.deleteBtn} onPress={() => removeTask(editing.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={styles.deleteBtnText}>{t("planner.deletePlan")}</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Attach picker (client / activity / shift) */}
      <Modal visible={!!attachOpen} transparent animationType="slide" onRequestClose={() => setAttachOpen(null)}>
        <Pressable style={styles.modalWrap} onPress={() => setAttachOpen(null)}>
          <Pressable style={[styles.sheet, { maxHeight: "70%" }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {attachOpen === "client" ? t("planner.pickParticipant") : attachOpen === "activity" ? t("planner.pickActivity") : t("planner.pickShiftOrTemplate")}
            </Text>

            {attachOpen === "client" && (
              <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 360 }}>
                {clientsList.length === 0 && <Text style={styles.hint}>{t("planner.noClients")}</Text>}
                {clientsList.map((c) => (
                  <Pressable key={c.id} testID={`pick-client-${c.id}`} style={styles.pickRow} onPress={() => applyClient(c)}>
                    <View style={[styles.pickIcon, { backgroundColor: (c.color || colors.brand) + "22" }]}>
                      <Ionicons name={(c.icon as any) || "person"} size={16} color={c.color || colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{c.name}</Text>
                      {!!c.ndis_number && <Text style={styles.pickMeta}>{c.ndis_number}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {attachOpen === "activity" && (
              <>
                {!clientId ? (
                  <Text style={styles.hint}>{t("planner.pickClientFirst")}</Text>
                ) : activityList.length === 0 ? (
                  <View style={{ paddingVertical: spacing.lg, alignItems: "center", gap: spacing.sm }}>
                    <Ionicons name="albums-outline" size={30} color={colors.muted} />
                    <Text style={styles.hint}>{t("planner.noActivities")}</Text>
                    <Text style={[styles.hint, { fontSize: 11 }]}>{t("planner.noActivitiesHint")}</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 360 }}>
                    <Pressable testID="clear-activity" style={styles.pickRow} onPress={() => { setActivityTemplateId(""); setActivityType(""); setAttachOpen(null); }}>
                      <View style={[styles.pickIcon, { backgroundColor: colors.muted + "22" }]}>
                        <Ionicons name="close-circle-outline" size={16} color={colors.muted} />
                      </View>
                      <Text style={[styles.pickName, { color: colors.muted }]}>{t("planner.clearActivity")}</Text>
                    </Pressable>
                    {activityList.map((a) => {
                      const m = activityMeta(a.activity_type);
                      return (
                        <Pressable key={a.id} testID={`pick-activity-${a.id}`} style={styles.pickRow} onPress={() => applyActivityTemplate(a)}>
                          <View style={[styles.pickIcon, { backgroundColor: m.color + "22" }]}>
                            <Ionicons name={m.icon as any} size={16} color={m.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickName}>{a.name}</Text>
                            <Text style={styles.pickMeta}>{[m.label, a.duration_min ? `${a.duration_min} min` : "", a.location].filter(Boolean).join(" · ")}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}

            {attachOpen === "shift" && (
              <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 420 }}>
                <Pressable testID="clear-shift-link" style={styles.pickRow} onPress={() => { setLinkedShiftId(""); setAttachOpen(null); }}>
                  <View style={[styles.pickIcon, { backgroundColor: colors.muted + "22" }]}>
                    <Ionicons name="close-circle-outline" size={16} color={colors.muted} />
                  </View>
                  <Text style={[styles.pickName, { color: colors.muted }]}>{t("planner.clearShift")}</Text>
                </Pressable>

                {/* Section: Reusable shift templates — apply one to pre-fill the form. */}
                {templateList.length > 0 && (
                  <>
                    <Text style={styles.pickerSection}>{t("planner.shiftTemplatesHeader")}</Text>
                    {templateList.map((tpl) => {
                      const timeRange = [tpl.start_time, tpl.end_time].filter(Boolean).join("–");
                      const meta = [timeRange, tpl.client_name].filter(Boolean).join(" · ") || t("planner.reusableTemplate");
                      return (
                        <Pressable key={`tpl-${tpl.id}`} testID={`pick-template-${tpl.id}`} style={styles.pickRow} onPress={() => applyTemplate(tpl)}>
                          <View style={[styles.pickIcon, { backgroundColor: colors.info + "22" }]}>
                            <Ionicons name="albums" size={16} color={colors.info} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickName}>{tpl.name || t("planner.reusableTemplate")}</Text>
                            <Text style={styles.pickMeta}>{meta}</Text>
                          </View>
                          <View style={styles.templateChip}>
                            <Text style={styles.templateChipText}>{t("planner.templateChip")}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}

                {/* Section: Planned shifts already scheduled. */}
                <Text style={styles.pickerSection}>{t("planner.plannedShiftsHeader")}</Text>
                {shiftsList.length === 0 && <Text style={styles.hint}>{t("planner.noSavedShifts")}</Text>}
                {shiftsList.map((s) => (
                  <Pressable key={s.id} testID={`pick-shift-${s.id}`} style={styles.pickRow} onPress={() => { setLinkedShiftId(s.id); setAttachOpen(null); }}>
                    <View style={[styles.pickIcon, { backgroundColor: colors.brand + "22" }]}>
                      <Ionicons name="calendar" size={16} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{s.scheduled_for || t("planner.savedShift")}</Text>
                      <Text style={styles.pickMeta}>{t("planner.shiftMeta", { count: s.invoice_count || 0, amount: money(s.total || 0) })}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                ))}

                {templateList.length === 0 && shiftsList.length === 0 && (
                  <Text style={[styles.hint, { textAlign: "center", paddingVertical: spacing.md }]}>{t("planner.noShiftsOrTemplates")}</Text>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: weight.heavy },
  dayCard: { width: 56, height: 68, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 2, flexShrink: 0 },
  dayActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayName: { color: colors.muted, fontSize: 12, fontWeight: weight.medium },
  dayNum: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  dayTextActive: { color: colors.onBrand },
  task: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  typeBar: { width: 4, height: 34, borderRadius: 2 },
  taskTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  taskMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  strike: { textDecorationLine: "line-through", color: colors.muted },
  empty: { alignItems: "center", marginTop: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: 14 },
  financeDot: { position: "absolute", bottom: 5, alignSelf: "center", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  financeBlock: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  financeHeading: { color: colors.muted, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.8, marginBottom: spacing.sm },
  financeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  financeIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  financeName: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  financeKind: { fontSize: 11, fontWeight: weight.bold },
  financeCost: { color: colors.onSurface, fontSize: 14, fontWeight: weight.heavy },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  typeChip: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  typeChipText: { color: colors.onSurfaceTertiary, fontWeight: weight.bold, textTransform: "capitalize" },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryBtnText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  dotRow: { position: "absolute", bottom: 5, alignSelf: "center", flexDirection: "row", gap: 3 },
  typeDot: { width: 5, height: 5, borderRadius: 2.5 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.md },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, backgroundColor: colors.surfaceSecondary },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  deleteBtn: { flexDirection: "row", gap: spacing.xs, alignItems: "center", justifyContent: "center", height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error + "66", marginTop: spacing.sm },
  deleteBtnText: { color: colors.error, fontWeight: weight.bold },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 3 },
  segBtn: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.brand },
  segText: { color: colors.muted, fontSize: 12, fontWeight: weight.bold },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  navLabel: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  weekRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  weekDateCol: { width: 44, alignItems: "center" },
  weekDayName: { color: colors.muted, fontSize: 11, fontWeight: weight.bold },
  weekDayNum: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  weekEmpty: { color: colors.muted, fontSize: 12 },
  weekChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  weekTask: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  weekMore: { color: colors.brand, fontSize: 11, fontWeight: weight.bold, marginTop: 2 },
  gridHead: { flexDirection: "row", marginBottom: spacing.xs },
  gridHeadText: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: weight.bold },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { width: "14.28%", aspectRatio: 0.82, padding: 2 },
  gridCellDay: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceSecondary, alignItems: "center", paddingTop: 6 },
  gridNum: { color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  gridBadge: { position: "absolute", top: 3, right: 3, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  gridBadgeText: { color: colors.onBrand, fontSize: 9, fontWeight: weight.heavy },
  gridDots: { position: "absolute", bottom: 5, flexDirection: "row", gap: 3 },
  monthSummary: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  attachLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginTop: spacing.md, marginBottom: spacing.sm, letterSpacing: 0.5 },
  durationHint: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, marginTop: -spacing.xs, marginBottom: spacing.sm, marginLeft: spacing.xs },
  attachGrid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  attachBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  attachBtnOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  attachText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  hint: { color: colors.muted, fontSize: 13, paddingVertical: spacing.sm },
  pickRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pickName: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  pickMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pickerSection: { color: colors.muted, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.7, marginTop: spacing.md, marginBottom: spacing.xs, paddingHorizontal: 2, textTransform: "uppercase" },
  templateChip: { backgroundColor: colors.info + "22", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  templateChipText: { color: colors.info, fontSize: 10, fontWeight: weight.heavy, letterSpacing: 0.5 },
});
