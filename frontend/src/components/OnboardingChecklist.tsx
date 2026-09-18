import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";

const DISMISS_KEY = "onboarding_dismissed_v1";
const ASSISTANT_KEY = "onboarding_assistant_tried_v1";

export function OnboardingChecklist() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [steps, setSteps] = useState({ profile: false, client: false, invoice: false, assistant: false });

  const load = useCallback(async () => {
    try {
      const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
      if (dismissed === "1") { setHidden(true); setLoading(false); return; }
      const [clients, invoices, settings, assistantTried] = await Promise.all([
        api.listClients().catch(() => []),
        api.listInvoices().catch(() => []),
        api.getSettings().catch(() => ({} as any)),
        AsyncStorage.getItem(ASSISTANT_KEY),
      ]);
      const profile = !!(settings?.abn) || (settings?.business_name && settings.business_name !== "Your Support Business");
      const next = {
        profile: !!profile,
        client: (clients?.length || 0) > 0,
        invoice: (invoices?.length || 0) > 0,
        assistant: assistantTried === "1",
      };
      setSteps(next);
      const allDone = next.profile && next.client && next.invoice && next.assistant;
      if (allDone) { await AsyncStorage.setItem(DISMISS_KEY, "1"); setHidden(true); }
      else setHidden(false);
    } catch {
      setHidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dismiss = async () => { await AsyncStorage.setItem(DISMISS_KEY, "1"); setHidden(true); };

  const go = async (key: string, route: string) => {
    if (key === "assistant") await AsyncStorage.setItem(ASSISTANT_KEY, "1");
    router.push(route as any);
  };

  if (loading || hidden) return null;

  const items = [
    { key: "profile", done: steps.profile, label: t("onboarding.step1"), route: "/settings" },
    { key: "client", done: steps.client, label: t("onboarding.step2"), route: "/(tabs)/clients" },
    { key: "invoice", done: steps.invoice, label: t("onboarding.step3"), route: "/invoice/new" },
    { key: "assistant", done: steps.assistant, label: t("onboarding.step4"), route: "/assistant" },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <View style={styles.card} testID="onboarding-checklist">
      <View style={styles.head}>
        <View style={styles.titleWrap}>
          <View style={styles.rocket}><Ionicons name="rocket" size={16} color={colors.onBrand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("onboarding.title")}</Text>
            <Text style={styles.sub}>{t("onboarding.progress", { done: doneCount, total: items.length })}</Text>
          </View>
        </View>
        <Pressable testID="onboarding-dismiss" onPress={dismiss} hitSlop={10} style={styles.dismissBtn}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(doneCount / items.length) * 100}%` }]} />
      </View>

      {items.map((it) => (
        <Pressable
          key={it.key}
          testID={`onboarding-${it.key}`}
          style={styles.row}
          onPress={() => go(it.key, it.route)}
          disabled={it.done}
        >
          <Ionicons
            name={it.done ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={it.done ? colors.success : colors.brand}
          />
          <Text style={[styles.rowLabel, it.done && styles.rowDone]}>{it.label}</Text>
          {!it.done && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.brand + "44" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  rocket: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: weight.heavy },
  sub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  dismissBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginBottom: spacing.md },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  rowLabel: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  rowDone: { color: colors.muted, textDecorationLine: "line-through" },
});
