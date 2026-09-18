import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { api, toDMY } from "@/src/api";
import { confirmAction } from "@/src/utils/confirm";
import { useCelebration } from "@/src/components/Celebration";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useTranslation } from "react-i18next";

const FEATURE_KEYS = ["feat1", "feat2", "feat3", "feat4", "feat5"];

export default function Membership() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const celebrate = useCelebration();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const [plans, setPlans] = useState<any[]>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [membership, setMembership] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [polling, setPolling] = useState(false);
  const polledRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([api.billingPlans(), api.billingMembership()]);
      setPlans(p.plans); setTrialDays(p.trial_days); setMembership(m);
      api.billingLimits().then(setLimits).catch(() => {});
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const poll = useCallback(async (sid: string) => {
    setPolling(true);
    for (let i = 0; i < 6; i++) {
      try {
        const res = await api.billingStatus(sid);
        if (res.payment_status === "paid") {
          setMembership(res.membership);
          celebrate(t("membership.active"), { sound: true });
          setPolling(false);
          return;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    setPolling(false);
    load();
  }, [celebrate, load]);

  // Web return with ?session_id
  useEffect(() => {
    if (params.session_id && !polledRef.current) {
      polledRef.current = true;
      poll(String(params.session_id));
    }
  }, [params.session_id, poll]);

  const subscribe = async (planId: string) => {
    setBusy(planId);
    try {
      // Where Stripe redirects back to after checkout — the app's own
      // origin, not the old (now-retired) backend URL. Native has no
      // window.location; its return flow doesn't depend on this URL
      // actually opening the app (see the poll() call below), so any
      // valid https URL is fine there.
      const origin = Platform.OS === "web" ? window.location.origin : "https://ndis-command-center.app";
      const { url, session_id } = await api.billingCheckout(planId, origin);
      if (Platform.OS === "web") {
        window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
        poll(session_id); // poll after the in-app browser closes
      }
    } catch (e: any) {
      Alert.alert(t("membership.checkoutErrorTitle"), t("membership.checkoutError"));
    } finally { setBusy(""); }
  };

  const cancel = () => {
    confirmAction({
      title: t("membership.cancelTitle"),
      message: t("membership.cancelMsg"),
      confirmText: t("membership.cancelConfirm"),
      cancelText: t("membership.cancelKeep"),
      destructive: true,
      onConfirm: async () => { const m = await api.billingCancel(); setMembership(m); },
    });
  };

  const fmtDate = (iso?: string) => (iso ? toDMY(iso) : "");

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>;

  const active = membership?.is_active;
  const currentPlan = membership?.plan;
  const isLifetime = currentPlan === "lifetime";
  const isTrial = membership?.status === "trialing";
  const trialDaysLeft = isTrial && membership?.expires_at
    ? Math.max(0, Math.ceil((new Date(membership.expires_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <View style={styles.container} testID="membership-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("membership.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Current status */}
        <LinearGradient colors={active ? ["#0A3A33", colors.surfaceSecondary] : [colors.surfaceSecondary, colors.surfaceSecondary]} style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: active ? colors.success + "22" : colors.warning + "22" }]}>
              <Ionicons name={isLifetime ? "infinite" : active ? "shield-checkmark" : "flash"} size={22} color={active ? colors.success : colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusPlan}>{isLifetime ? t("membership.lifetime") : isTrial ? t("membership.trialPlan") : active ? (plans.find((p) => p.id === currentPlan)?.name || t("membership.pro")) : t("membership.free")}</Text>
              <Text style={styles.statusMeta} testID="membership-status">
                {isLifetime
                  ? t("membership.lifetimeAccess")
                  : isTrial
                  ? t("membership.trialEnds", { date: fmtDate(membership.expires_at), days: trialDaysLeft })
                  : active
                  ? (membership.status === "canceled"
                      ? t("membership.cancels", { date: fmtDate(membership.expires_at) })
                      : t("membership.renews", { date: fmtDate(membership.expires_at) }))
                  : t("membership.startTrialMeta", { days: trialDays })}
              </Text>
            </View>
            {polling && <ActivityIndicator color={colors.brand} />}
          </View>
        </LinearGradient>

        {limits?.tier === "free" && limits?.limits && (
          <View style={styles.usageCard} testID="usage-card">
            <Text style={styles.usageTitle}>{t("membership.usageTitle")}</Text>
            {[
              { k: "usageClients", used: limits.usage.clients, max: limits.limits.clients },
              { k: "usageInvoices", used: limits.usage.invoices_this_month, max: limits.limits.invoices_per_month },
              { k: "usageAi", used: limits.usage.ai_this_month, max: limits.limits.ai_per_month },
            ].map((u) => (
              <View key={u.k} style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.usageLabel}>{t(`membership.${u.k}`)}</Text>
                  <Text style={[styles.usageVal, u.used >= u.max && { color: colors.warning }]}>{u.used}/{u.max}</Text>
                </View>
                <View style={styles.usageTrack}>
                  <View style={[styles.usageFill, { width: `${Math.min(100, (u.used / u.max) * 100)}%` as any, backgroundColor: u.used >= u.max ? colors.warning : colors.brand }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {isLifetime ? (
          <View style={styles.lifetimeCard}>
            <Ionicons name="ribbon" size={26} color={colors.brand} />
            <Text style={styles.lifetimeTitle}>{t("membership.lifetimeTitle")}</Text>
            <Text style={styles.lifetimeSub}>{t("membership.lifetimeSub")}</Text>
            {FEATURE_KEYS.map((fk) => (
              <View key={fk} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
                <Text style={styles.featureText}>{t(`membership.${fk}`)}</Text>
              </View>
            ))}
          </View>
        ) : (
        <>
        {/* Plans */}
        <Text style={styles.section}>{t("membership.choosePlan")}</Text>
        {plans.map((p) => {
          const isCurrent = active && currentPlan === p.id;
          const yearly = p.id === "pro_yearly";
          return (
            <View key={p.id} style={[styles.planCard, yearly && styles.planCardFeatured]} testID={`plan-${p.id}`}>
              {yearly && <View style={styles.badge}><Text style={styles.badgeText}>{t("membership.bestValue")}</Text></View>}
              <View style={styles.planHead}>
                <Text style={styles.planName}>{p.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>${p.amount}</Text>
                  <Text style={styles.period}>{yearly ? t("membership.perYear") : t("membership.perMonth")}</Text>
                </View>
              </View>
              {FEATURE_KEYS.map((fk) => (
                <View key={fk} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
                  <Text style={styles.featureText}>{t(`membership.${fk}`)}</Text>
                </View>
              ))}
              <Pressable
                testID={`subscribe-${p.id}`}
                style={[styles.subBtn, yearly && styles.subBtnFeatured, isCurrent && styles.subBtnDisabled]}
                onPress={() => !isCurrent && subscribe(p.id)}
                disabled={isCurrent || busy === p.id}
              >
                {busy === p.id ? <ActivityIndicator color={colors.onBrand} /> : (
                  <Text style={[styles.subText, yearly && { color: colors.onBrand }]}>
                    {isCurrent ? t("membership.currentPlan") : isTrial ? t("membership.subscribe") : active ? t("membership.switchPlan") : t("membership.startTrial", { days: trialDays })}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}

        {active && !isTrial && membership.status !== "canceled" && (
          <Pressable testID="cancel-membership" style={styles.cancelBtn} onPress={cancel}>
            <Text style={styles.cancelText}>{t("membership.cancel")}</Text>
          </Pressable>
        )}

        <Text style={styles.fine}>{t("membership.fine")}</Text>
        </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  statusCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusPlan: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  statusMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  section: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.md },
  planCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  planCardFeatured: { borderColor: colors.brand, borderWidth: 1.5 },
  badge: { alignSelf: "flex-start", backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, marginBottom: spacing.sm },
  badgeText: { color: colors.onBrand, fontSize: 10, fontWeight: weight.heavy, letterSpacing: 0.5 },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  planName: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  priceRow: { flexDirection: "row", alignItems: "flex-end" },
  price: { color: colors.onSurface, fontSize: 24, fontWeight: weight.heavy },
  period: { color: colors.muted, fontSize: 13, marginBottom: 3, marginLeft: 2 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { color: colors.onSurfaceTertiary, fontSize: 14 },
  subBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginTop: spacing.md, borderWidth: 1, borderColor: colors.borderStrong },
  subBtnFeatured: { backgroundColor: colors.brand, borderColor: colors.brand },
  subBtnDisabled: { opacity: 0.5 },
  subText: { color: colors.onSurface, fontWeight: weight.heavy, fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { color: colors.error, fontWeight: weight.bold },
  fine: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.lg, lineHeight: 18 },
  lifetimeCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1.5, borderColor: colors.brand, marginTop: spacing.lg, gap: spacing.sm },
  lifetimeTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginTop: spacing.sm },
  lifetimeSub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  usageCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.md },
  usageTitle: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 1 },
  usageLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold },
  usageVal: { color: colors.onSurface, fontSize: 13, fontWeight: weight.heavy },
  usageTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: spacing.xs, overflow: "hidden" },
  usageFill: { height: 6, borderRadius: 3 },
});
