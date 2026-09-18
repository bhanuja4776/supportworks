import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api, money } from "@/src/api";
import { TipsBanner } from "@/src/components/TipsBanner";
import { colors, radius, spacing, weight } from "@/src/theme";
import { NotesCard } from "@/src/components/NotesCard";
import { OnboardingChecklist } from "@/src/components/OnboardingChecklist";

const HERO_BG =
  "https://images.unsplash.com/photo-1709990740078-05aa8ee5b9b7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBmdXR1cmlzdGljJTIwdGVjaCUyMGN5YW58ZW58MHx8fHwxNzgyOTg3NzAzfDA&ixlib=rb-4.1.0&q=85";

const QUICK = [
  { key: "invoice", labelKey: "dashboard.qInvoice", icon: "add-circle", route: "/invoice/new", tint: colors.success },
  { key: "scan", labelKey: "dashboard.qScan", icon: "scan", route: "/(tabs)/scan", tint: colors.brand },
  { key: "client", labelKey: "dashboard.qClient", icon: "person-add", route: "/(tabs)/clients", tint: colors.info },
  { key: "task", labelKey: "dashboard.qTask", icon: "calendar", route: "/(tabs)/planner", tint: colors.warning },
] as const;

const TOOLS = [
  { key: "scanText", labelKey: "dashboard.tScanText", icon: "text", route: "/(tabs)/scan-text" },
  { key: "ndis", labelKey: "dashboard.tNdis", icon: "list-circle", route: "/ndis-codes" },
  { key: "vault", labelKey: "dashboard.tVault", icon: "folder-open", route: "/vault" },
  { key: "reports", labelKey: "dashboard.tReports", icon: "bar-chart", route: "/reports" },
  { key: "credentials", labelKey: "dashboard.tCerts", icon: "ribbon", route: "/credentials" },
  { key: "templates", labelKey: "dashboard.tTemplates", icon: "documents", route: "/templates" },
  { key: "account", labelKey: "dashboard.tAccount", icon: "person-circle", route: "/account" },
  { key: "membership", labelKey: "dashboard.tMembership", icon: "diamond", route: "/membership" },
  { key: "settings", labelKey: "dashboard.tBusiness", icon: "settings", route: "/settings" },
  { key: "help", labelKey: "dashboard.tHelp", icon: "help-buoy", route: "/help" },
] as const;

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);
  const [onShift, setOnShift] = useState(false);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [s, t, o, u, m, as] = await Promise.all([
        api.stats(), api.listTasks(today), api.outstanding(), api.upcoming(14),
        api.billingMembership().catch(() => null),
        api.activeShift().catch(() => ({ shift: null })),
      ]);
      setStats(s);
      setTasks(t);
      setOutstanding(o);
      setUpcoming(u);
      setMembership(m);
      setOnShift(!!as?.shift);
    } catch (e) {
      // keep last state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dateStr = new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long",
  });

  const trialDaysLeft =
    membership?.status === "trialing" && membership?.expires_at
      ? Math.max(0, Math.ceil((new Date(membership.expires_at).getTime() - Date.now()) / 86400000))
      : null;

  return (
    <View style={styles.container} testID="dashboard-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brand}
          />
        }
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <Image source={{ uri: HERO_BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(4,16,20,0.35)", "rgba(4,16,20,0.85)", colors.surface]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.eyebrow}>NDIS COMMAND CENTER</Text>
          <Text style={styles.date}>{dateStr}</Text>

          {loading && !stats ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
          ) : (
            <View style={styles.heroCards}>
              <View style={[styles.metricCard, styles.metricPrimary]} testID="metric-earnings">
                <Ionicons name="trending-up" size={20} color={colors.success} />
                <Text style={styles.metricValue}>{money(stats?.earnings || 0)}</Text>
                <Text style={styles.metricLabel}>{t("dashboard.paidThisPeriod")}</Text>
              </View>
              <Pressable style={[styles.metricCard, styles.metricPrimary]} testID="metric-outstanding" onPress={() => setShowOutstanding((v) => !v)}>
                <Ionicons name="hourglass" size={20} color={colors.warning} />
                <Text style={styles.metricValue}>{money(stats?.outstanding || 0)}</Text>
                <View style={styles.metricLabelRow}>
                  <Text style={styles.metricLabel}>{t("dashboard.outstanding", { count: stats?.unpaid_count || 0 })}</Text>
                  {(stats?.unpaid_count || 0) > 0 && (
                    <Ionicons name={showOutstanding ? "chevron-up" : "chevron-down"} size={14} color={colors.warning} />
                  )}
                </View>
              </Pressable>
            </View>
          )}
        </View>

        {/* Free-trial countdown */}
        {trialDaysLeft != null && (
          <Pressable testID="trial-banner" style={styles.trialBanner} onPress={() => router.push("/membership")}>
            <Ionicons name="gift" size={18} color={colors.success} />
            <Text style={styles.trialText}>{t("dashboard.trialBanner", { days: trialDaysLeft })}</Text>
            <Text style={styles.trialCta}>{t("dashboard.trialCta")}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.success} />
          </Pressable>
        )}

        {/* Educational tips carousel */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <TipsBanner />
        </View>

        {/* Getting Started onboarding checklist (auto-hides when complete/dismissed) */}
        <OnboardingChecklist />

        {/* Outstanding dropdown */}
        {showOutstanding && outstanding.length > 0 && (
          <View style={styles.dropdown} testID="outstanding-dropdown">
            <Text style={styles.dropdownHeader}>{t("dashboard.outstandingInvoices")}</Text>
            {outstanding.map((inv) => (
              <Pressable key={inv.id} testID={`outstanding-${inv.id}`} style={styles.dropRow} onPress={() => router.push(`/invoice/${inv.id}`)}>
                <View style={[styles.initialsBadge, { backgroundColor: (inv.client_color || colors.brand) + "22", borderColor: inv.client_color || colors.brand }]}>
                  <Text style={[styles.initialsText, { color: inv.client_color || colors.brand }]}>{inv.client_initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropTitle}>{inv.invoice_number} · {inv.client_name || "Client"}</Text>
                  <Text style={styles.dropMeta}>
                    {inv.days_since_sent != null ? t("dashboard.daysSinceSent", { days: inv.days_since_sent }) : t("dashboard.notSent")}
                    {inv.shift_date ? ` · shift ${inv.shift_date}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.dropOwing}>{money(inv.total)}</Text>
                  <Text style={styles.dropOwingLabel}>{t("dashboard.owing")}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Upcoming costs & renewals */}
        {upcoming.length > 0 && (
          <View style={styles.upcoming} testID="upcoming-strip">
            <View style={styles.upcomingHead}>
              <Ionicons name="alarm" size={16} color={colors.brand} />
              <Text style={styles.upcomingTitle}>{t("dashboard.upcomingTitle")}</Text>
              <Text style={styles.upcomingCount}>{t("dashboard.next14")}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
              {upcoming.map((u) => {
                const overdue = u.days_until < 0;
                const soon = u.days_until >= 0 && u.days_until <= 3;
                const tint = u.kind === "cert" ? colors.info : overdue ? colors.error : soon ? colors.warning : colors.brand;
                const icon = u.kind === "cert" ? "ribbon" : u.kind === "renewal" ? "refresh" : u.direct_debit ? "repeat" : "card";
                const when = overdue ? t("dashboard.overdueDays", { days: Math.abs(u.days_until) }) : u.days_until === 0 ? t("dashboard.today") : t("dashboard.inDays", { days: u.days_until });
                return (
                  <Pressable key={u.id} testID={`upcoming-${u.id}`} style={[styles.upCard, { borderColor: tint + "55" }]} onPress={() => router.push("/vault")}>
                    <View style={styles.upCardTop}>
                      <View style={[styles.upIcon, { backgroundColor: tint + "22" }]}>
                        <Ionicons name={icon as any} size={16} color={tint} />
                      </View>
                      <View style={[styles.upWhenPill, { backgroundColor: tint + "22" }]}>
                        <Text style={[styles.upWhen, { color: tint }]}>{when}</Text>
                      </View>
                    </View>
                    <Text style={styles.upTitle} numberOfLines={1}>{u.title}</Text>
                    <Text style={styles.upSub} numberOfLines={1}>{u.subtitle || u.date}</Text>
                    {u.amount > 0 && <Text style={styles.upAmount}>{money(u.amount)}</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Secondary metrics */}
        <View style={styles.subRow}>
          <MiniStat label={t("dashboard.expenses")} value={money(stats?.expenses || 0)} icon="wallet" tint={colors.error} onPress={() => router.push("/vault")} testID="ministat-expenses" />
          <MiniStat label={t("dashboard.gstCollected")} value={money(stats?.gst_collected || 0)} icon="cash" tint={colors.info} />
        </View>

        {/* Overdue alert */}
        {!!stats?.overdue_count && (
          <Pressable testID="overdue-alert" style={styles.overdue} onPress={() => router.push("/(tabs)/invoices")}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={styles.overdueText}>
              {stats.overdue_count === 1
                ? t("dashboard.overdueOne", { count: stats.overdue_count, amount: money(stats.overdue_amount) })
                : t("dashboard.overdueMany", { count: stats.overdue_count, amount: money(stats.overdue_amount) })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.warning} />
          </Pressable>
        )}

        {/* Today's Notes */}
        <NotesCard />

        {/* Current Shift / Create Shift */}
        {onShift && (
          <Pressable testID="current-shift-cta" style={[styles.startShift, { backgroundColor: colors.success }]} onPress={() => router.push("/shift")}>
            <Ionicons name="radio-button-on" size={24} color={colors.onBrand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.startShiftTitle}>{t("dashboard.currentShift")}</Text>
              <Text style={styles.startShiftSub}>{t("dashboard.currentShiftSub")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onBrand} />
          </Pressable>
        )}
        <Pressable testID="start-shift-cta" style={[styles.startShift, onShift && { marginTop: spacing.sm }]} onPress={() => router.push("/shift")}>
          <Ionicons name={onShift ? "add-circle" : "play-circle"} size={24} color={colors.onBrand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.startShiftTitle}>{t("dashboard.createShift")}</Text>
            <Text style={styles.startShiftSub}>{t("dashboard.createShiftSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onBrand} />
        </Pressable>

        {/* AI Code Assistant banner */}
        <Pressable testID="assistant-banner" style={styles.aiBanner} onPress={() => router.push("/assistant")}>
          <View style={styles.aiBannerIcon}><Ionicons name="sparkles" size={22} color={colors.onBrand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiBannerTitle}>{t("dashboard.assistantTitle")}</Text>
            <Text style={styles.aiBannerSub}>{t("dashboard.assistantSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brand} />
        </Pressable>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>{t("dashboard.quickActions")}</Text>
        <View style={styles.quickGrid}>
          {QUICK.map((q) => (
            <Pressable
              key={q.key}
              testID={`quick-${q.key}`}
              style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
              onPress={() => router.push(q.route as any)}
            >
              <View style={[styles.quickIcon, { backgroundColor: q.tint + "22", borderColor: q.tint + "55" }]}>
                <Ionicons name={q.icon as any} size={24} color={q.tint} />
              </View>
              <Text style={styles.quickLabel}>{t(q.labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tools */}
        <Text style={styles.sectionTitle}>{t("dashboard.tools")}</Text>
        <View style={styles.toolsRow}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              testID={`tool-${tool.key}`}
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}
              onPress={() => router.push(tool.route as any)}
            >
              <Ionicons name={tool.icon as any} size={22} color={colors.brand} />
              <Text style={styles.toolLabel}>{t(tool.labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Today's planner */}
        <View style={styles.plannerHeader}>
          <Text style={styles.sectionTitle}>{t("dashboard.timeline")}</Text>
          <Text style={styles.progress}>
            {t("dashboard.tasksDone", { done: stats?.tasks_done_today || 0, total: stats?.tasks_today || 0 })}
          </Text>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={26} color={colors.brand} />
            <Text style={styles.emptyText}>{t("dashboard.emptyTasks")}</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.timelineRow} testID={`timeline-${task.id}`}>
              <View style={[styles.dot, { backgroundColor: task.completed ? colors.success : colors.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.timelineTitle, task.completed && styles.strike]}>{task.title}</Text>
                <Text style={styles.timelineMeta}>
                  {task.time || t("dashboard.anytime")} · {task.type}
                </Text>
              </View>
              {task.completed && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value, icon, tint, onPress, testID }: any) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.miniCard} onPress={onPress} testID={testID}>
      <View style={[styles.miniIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.miniValue}>{value}</Text>
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, overflow: "hidden" },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, letterSpacing: 2 },
  date: { color: colors.onSurface, fontSize: 22, fontWeight: weight.heavy, marginTop: spacing.xs },
  heroCards: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  metricCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(10,30,36,0.75)",
    gap: spacing.xs,
  },
  metricPrimary: {},
  metricValue: { color: colors.onSurface, fontSize: 24, fontWeight: weight.heavy, marginTop: spacing.xs },
  metricLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.medium },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  trialBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.success + "14", borderWidth: 1, borderColor: colors.success + "55" },
  trialText: { flex: 1, color: colors.success, fontSize: 13, fontWeight: weight.bold },
  trialCta: { color: colors.success, fontSize: 12, fontWeight: weight.heavy },
  dropdown: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning + "44", overflow: "hidden" },
  dropdownHeader: { color: colors.warning, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  dropRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  initialsBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  initialsText: { fontSize: 13, fontWeight: weight.heavy },
  dropTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  dropMeta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  dropOwing: { color: colors.warning, fontSize: 15, fontWeight: weight.heavy },
  dropOwingLabel: { color: colors.onSurfaceTertiary, fontSize: 10 },
  upcoming: { marginTop: spacing.lg, paddingLeft: spacing.lg },
  upcomingHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  upcomingTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  upcomingCount: { color: colors.muted, fontSize: 11, fontWeight: weight.medium },
  upCard: { width: 168, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: spacing.xs },
  upCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  upIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  upWhenPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  upWhen: { fontSize: 11, fontWeight: weight.heavy },
  upTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  upSub: { color: colors.muted, fontSize: 12 },
  upAmount: { color: colors.brand, fontSize: 15, fontWeight: weight.heavy, marginTop: spacing.xs },
  subRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  overdue: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warning + "1A", borderWidth: 1, borderColor: colors.warning + "55" },
  overdueText: { flex: 1, color: colors.warning, fontSize: 13, fontWeight: weight.bold },
  startShift: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.lg },
  startShiftTitle: { color: colors.onBrand, fontSize: 17, fontWeight: weight.heavy },
  startShiftSub: { color: colors.onBrand, fontSize: 12, opacity: 0.8, marginTop: 2 },
  miniCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  miniValue: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  miniLabel: { color: colors.muted, fontSize: 11, fontWeight: weight.medium },
  aiBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.brand + "55" },
  aiBannerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  aiBannerTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  aiBannerSub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: colors.onSurface,    fontSize: 16,
    fontWeight: weight.bold,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  quickCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  quickIcon: {
    width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  quickLabel: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  toolsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  toolCard: {
    width: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold },
  plannerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: spacing.lg },
  progress: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, marginTop: spacing.xl, marginBottom: spacing.md },
  emptyCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 13 },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  timelineMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  strike: { textDecorationLine: "line-through", color: colors.muted },
});
