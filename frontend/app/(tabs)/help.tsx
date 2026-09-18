import { useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useTranslation } from "react-i18next";
import { useVoice } from "@/src/useVoice";

type Msg = { role: "user" | "assistant"; content: string };
const QUICK = ["help.q1", "help.q2", "help.q3", "help.q4", "help.q5", "help.q6"];
const HOW_IT_WORKS: { icon: any; titleKey: string; bodyKey: string }[] = [
  { icon: "people", titleKey: "help.howItWorksStep1Title", bodyKey: "help.howItWorksStep1Body" },
  { icon: "folder", titleKey: "help.howItWorksStep2Title", bodyKey: "help.howItWorksStep2Body" },
  { icon: "trending-up", titleKey: "help.howItWorksStep3Title", bodyKey: "help.howItWorksStep3Body" },
];

export default function Help() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const { recording, transcribing, start, stop } = useVoice();
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: t("help.intro") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const res = await api.appHelp(next.map((m) => ({ role: m.role, content: m.content })));
      setMessages((m) => [...m, { role: "assistant", content: res.answer || t("help.error") }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("help.error") }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  const onMic = async () => {
    if (recording) {
      const text = await stop();
      if (text) setInput((v) => (v ? `${v} ${text}` : text));
    } else {
      await start();
    }
  };

  return (
    <View style={styles.container} testID="help-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("help.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 40}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
              {m.role === "assistant" && (
                <View style={styles.aiTag}>
                  <Ionicons name="help-buoy" size={13} color={colors.brand} />
                  <Text style={styles.aiTagText}>{t("help.title")}</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, m.role === "user" && { color: colors.onBrand }]}>{m.content}</Text>
            </View>
          ))}

          {busy && (
            <View style={[styles.bubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.typing}>{t("help.thinking")}</Text>
            </View>
          )}

          {messages.length <= 1 && !busy && (
            <>
              <View style={styles.howItWorksWrap} testID="how-it-works">
                <Text style={styles.sectionTitle}>{t("help.howItWorksTitle")}</Text>
                {HOW_IT_WORKS.map((step) => (
                  <View key={step.titleKey} style={styles.stepCard}>
                    <View style={styles.stepIconWrap}>
                      <Ionicons name={step.icon} size={20} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>{t(step.titleKey)}</Text>
                      <Text style={styles.stepBody}>{t(step.bodyKey)}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.stayOnTopWrap} testID="stay-on-top">
                <View style={styles.stepIconWrap}>
                  <Ionicons name="apps" size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t("help.stayOnTopTitle")}</Text>
                  <Text style={styles.stepBody}>{t("help.stayOnTopBody")}</Text>
                </View>
              </View>

              <View style={styles.quickWrap}>
                <Text style={styles.quickTitle}>{t("help.quickTitle")}</Text>
                {QUICK.map((k) => (
                  <Pressable key={k} testID={`quick-${k}`} style={styles.quickChip} onPress={() => send(t(k))}>
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.brand} />
                    <Text style={styles.quickText}>{t(k)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom || spacing.md }]}>
          <TextInput
            testID="help-input"
            value={input}
            onChangeText={setInput}
            placeholder={recording ? t("help.listening") : t("help.inputPlaceholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send()}
          />
          <Pressable testID="help-mic" onPress={onMic} style={[styles.micBtn, recording && styles.micBtnActive]}>
            {transcribing ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name={recording ? "stop" : "mic"} size={20} color={recording ? colors.onBrand : colors.brand} />}
          </Pressable>
          <Pressable testID="help-send" style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.5 }]} onPress={() => send()} disabled={!input.trim() || busy}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrand} />
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>{t("help.disclaimer")}</Text>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  bubble: { maxWidth: "88%", borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  aiTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.xs },
  aiTagText: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 0.5 },
  bubbleText: { color: colors.onSurface, fontSize: 14.5, lineHeight: 21 },
  typing: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  sectionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy, marginBottom: spacing.sm },
  howItWorksWrap: { marginTop: spacing.sm, marginBottom: spacing.lg },
  stepCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  stepIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  stepTitle: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold, marginBottom: 2 },
  stepBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  stayOnTopWrap: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.brandTertiary + "55", borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.md, marginBottom: spacing.lg },
  quickWrap: { marginTop: spacing.md },
  quickTitle: { color: colors.muted, fontSize: 12, fontWeight: weight.heavy, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: spacing.sm },
  quickChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.sm },
  quickText: { color: colors.onSurface, fontSize: 14, fontWeight: weight.medium, flex: 1 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.onSurface, fontSize: 15, maxHeight: 120, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  micBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  micBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  disclaimer: { color: colors.muted, fontSize: 11, textAlign: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
