import { useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView, StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing, weight } from "@/src/theme";

const SLIDES: { icon: any; t: string; b: string; color: string }[] = [
  { icon: "rocket", t: "onboarding.s1title", b: "onboarding.s1body", color: colors.brand },
  { icon: "scan-circle", t: "onboarding.s2title", b: "onboarding.s2body", color: "#00A7C4" },
  { icon: "document-text", t: "onboarding.s3title", b: "onboarding.s3body", color: colors.success },
  { icon: "people", t: "onboarding.s4title", b: "onboarding.s4body", color: "#8B5CF6" },
  { icon: "calendar", t: "onboarding.s5title", b: "onboarding.s5body", color: colors.warning },
  { icon: "sparkles", t: "onboarding.s6title", b: "onboarding.s6body", color: "#F472B6" },
  { icon: "gift", t: "onboarding.s7title", b: "onboarding.s7body", color: colors.success },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Not useWindowDimensions()'s width: on web the screen itself is capped
  // to a centred, max-width column (see app/_layout.tsx) that's narrower
  // than the full browser window on desktop, so sizing/paging slides off
  // the raw window width made them overflow past the visible column. This
  // screen's own rendered width (measured via onLayout) is always correct
  // on both native (== window width) and web (== the capped column width).
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth);
  const width = containerWidth || windowWidth;
  const { t } = useTranslation();
  const { completeOnboarding } = useAuth();
  const params = useLocalSearchParams<{ tour?: string }>();
  const isTour = params.tour === "1";
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await completeOnboarding();
    if (isTour) router.replace("/account");
    else router.replace("/(tabs)");
  };

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    Haptics.selectionAsync();
  };

  const onScroll = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View
      style={styles.container}
      testID="onboarding-screen"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0A2A33", colors.surface, colors.surface]} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="onboarding-skip" onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>{t("onboarding.skip")}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.t} style={[styles.slide, { width }]}>
            <View style={[styles.iconWrap, { backgroundColor: s.color + "22", borderColor: s.color + "55" }]}>
              <Ionicons name={s.icon} size={64} color={s.color} />
            </View>
            <Text style={styles.title}>{t(s.t)}</Text>
            <Text style={styles.body}>{t(s.b)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.nav}>
          {index > 0 ? (
            <Pressable testID="onboarding-back" style={styles.ghostBtn} onPress={() => goTo(index - 1)}>
              <Text style={styles.ghostText}>{t("onboarding.back")}</Text>
            </Pressable>
          ) : <View style={{ width: 90 }} />}

          <Pressable
            testID={last ? "onboarding-getstarted" : "onboarding-next"}
            style={styles.primaryBtn}
            onPress={() => (last ? finish() : goTo(index + 1))}
          >
            <Text style={styles.primaryText}>{last ? t("onboarding.getStarted") : t("onboarding.next")}</Text>
            {!last && <Ionicons name="arrow-forward" size={18} color={colors.onBrand} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  skip: { color: colors.muted, fontSize: 15, fontWeight: weight.bold },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.lg },
  iconWrap: { width: 132, height: 132, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: weight.heavy, textAlign: "center", lineHeight: 32 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: "center", paddingHorizontal: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 22, backgroundColor: colors.brand },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ghostBtn: { width: 90, height: 52, alignItems: "flex-start", justifyContent: "center" },
  ghostText: { color: colors.muted, fontSize: 16, fontWeight: weight.bold },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 52, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: colors.brand, justifyContent: "center", minWidth: 140 },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 16 },
});
