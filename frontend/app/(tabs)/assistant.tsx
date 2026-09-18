import { useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator,
  Platform, Modal, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, money } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { FAQ_CATEGORIES, ALL_FAQ_QUESTIONS, pickRandom } from "@/src/assistantFaqs";
import { useTranslation } from "react-i18next";
import { useVoice } from "@/src/useVoice";

type Msg = { role: "user" | "assistant"; content: string; codes?: any[] };

// Map each FAQ question to its category key for smart follow-ups.
const QUESTION_CATEGORY: Record<string, string> = {};
FAQ_CATEGORIES.forEach((c) => c.questions.forEach((q) => { QUESTION_CATEGORY[q] = c.key; }));

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: t("assistant.intro"),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(() => pickRandom(ALL_FAQ_QUESTIONS, 4));
  const [asked, setAsked] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [attach, setAttach] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [attachBusy, setAttachBusy] = useState("");
  const { recording, transcribing, start, stop } = useVoice();

  const onMic = async () => {
    if (recording) {
      const text = await stop();
      if (text) setInput((v) => (v ? `${v} ${text}` : text));
    } else {
      await start();
    }
  };

  const activeCategory = useMemo(() => FAQ_CATEGORIES.find((c) => c.key === activeCat) || null, [activeCat]);

  const selectCategory = (key: string) => {
    const cat = FAQ_CATEGORIES.find((c) => c.key === key);
    if (!cat) return;
    setActiveCat(key);
    setSuggestions(pickRandom(cat.questions, Math.min(5, cat.questions.length), asked));
  };

  const shuffle = () => {
    const pool = activeCategory ? activeCategory.questions : ALL_FAQ_QUESTIONS;
    setSuggestions(pickRandom(pool, Math.min(4, pool.length)));
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setFollowUps([]);
    setAsked((a) => (a.includes(content) ? a : [...a, content]));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const payload = next.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }));
      const res = await api.ndisAssistant(payload);
      setMessages((m) => [...m, { role: "assistant", content: res.answer, codes: res.codes }]);
      // Smart follow-ups: use the category of the asked question (or the active one).
      const catKey = QUESTION_CATEGORY[content] || activeCat;
      const cat = FAQ_CATEGORIES.find((c) => c.key === catKey);
      const pool = cat ? cat.questions : ALL_FAQ_QUESTIONS;
      setFollowUps(pickRandom(pool, 3, [...asked, content]));
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("assistant.errorReach") }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  // Attach a suggested code: onto the active shift's draft, an existing unpaid draft, or a new invoice.
  const openAttach = async (c: any) => {
    setAttach(c);
    try {
      const [invs, act] = await Promise.all([api.listInvoices(), api.activeShift()]);
      const shiftInvs = (act?.invoices as any[]) || [];
      const ids = new Set<string>(shiftInvs.map((i: any) => i.id));
      setActiveShift(act?.shift ? { ...act.shift, invoices: shiftInvs } : null);
      // "Other" drafts are drafts NOT already linked to the active shift.
      const dr = ((invs as any[]) || [])
        .filter((i: any) => i.status === "draft" && !ids.has(i.id))
        .slice(0, 8);
      setDrafts(dr);
    } catch {
      setDrafts([]);
      setActiveShift(null);
    }
  };

  const attachTo = async (inv: any) => {
    if (!attach) return;
    setAttachBusy(inv.id);
    try {
      await api.addInvoiceItem(inv.id, { description: attach.name, ndis_code: attach.code, quantity: 1, rate: attach.rate });
      const code = attach.code;
      setAttach(null);
      Alert.alert(t("assistant.addedTo", { code, number: inv.invoice_number }), "", [
        { text: t("common.done") },
        { text: t("assistant.viewInvoice"), onPress: () => router.push(`/invoice/${inv.id}` as any) },
      ]);
    } catch {
      Alert.alert(t("assistant.errorReach"));
    } finally {
      setAttachBusy("");
    }
  };

  // Attach to the active shift: use its first existing draft, or create a new draft
  // for the shift's participant and add the item to it.
  const attachToActiveShift = async () => {
    if (!attach || !activeShift) return;
    setAttachBusy("shift");
    try {
      let target = (activeShift.invoices || [])[0];
      if (!target) {
        // Create a new draft invoice linked to this shift.
        // Pull the first client attached to the shift.
        const clientId = (activeShift.client_ids || [])[0] || "";
        let clientName = "";
        let ndis = "";
        if (clientId) {
          try {
            const cl = await api.getClient(clientId);
            clientName = cl?.name || "";
            ndis = cl?.ndis_number || "";
          } catch {}
        }
        const today = new Date().toISOString().slice(0, 10);
        const created = await api.createInvoice({
          client_id: clientId,
          client_name: clientName,
          ndis_number: ndis,
          shift_id: activeShift.id,
          issue_date: today,
          service_date: today,
          items: [{ description: attach.name, ndis_code: attach.code, quantity: 1, rate: attach.rate }],
          status: "draft",
        });
        target = created;
      } else {
        await api.addInvoiceItem(target.id, { description: attach.name, ndis_code: attach.code, quantity: 1, rate: attach.rate });
      }
      const code = attach.code;
      setAttach(null);
      Alert.alert(t("assistant.addedToShift", { code }), "", [
        { text: t("common.done") },
        { text: t("assistant.viewInvoice"), onPress: () => target?.id && router.push(`/invoice/${target.id}` as any) },
      ]);
    } catch {
      Alert.alert(t("assistant.errorReach"));
    } finally {
      setAttachBusy("");
    }
  };

  const newInvoiceWith = (c: any) => {
    setAttach(null);
    router.push({ pathname: "/invoice/new", params: { presetCode: c.code, presetDesc: c.name, presetRate: String(c.rate) } } as any);
  };

  const showIntro = messages.length <= 1;

  return (
    <View style={styles.container} testID="assistant-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.aiDot}><Ionicons name="sparkles" size={14} color={colors.onBrand} /></View>
          <Text style={styles.headerTitle}>{t("assistant.title")}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Category quick-picks */}
      <View style={styles.catBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
          {FAQ_CATEGORIES.map((c) => {
            const on = activeCat === c.key;
            return (
              <Pressable key={c.key} testID={`faq-cat-${c.key}`} onPress={() => selectCategory(c.key)} style={[styles.catChip, on && styles.catChipOn]}>
                <Ionicons name={c.icon as any} size={14} color={on ? colors.onBrand : colors.brand} />
                <Text style={[styles.catChipText, on && { color: colors.onBrand }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 44}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, m.role === "user" && { color: colors.onBrand }]}>{m.content}</Text>
              </View>
              {!!m.codes?.length && (
                <View style={styles.codeList}>
                  {m.codes.map((c) => (
                    <Pressable key={c.code} testID={`use-code-${c.code}`} style={styles.codeChip} onPress={() => openAttach(c)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.codeNum}>{c.code}</Text>
                        <Text style={styles.codeName} numberOfLines={2}>{c.name}</Text>
                        <Text style={styles.codeRate}>{money(c.rate)} / {c.unit}</Text>
                      </View>
                      <View style={styles.useBtn}>
                        <Ionicons name="add-circle" size={16} color={colors.brand} />
                        <Text style={styles.useText}>{t("assistant.invoiceBtn")}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
          {busy && (
            <View style={[styles.bubbleRow, styles.rowLeft]}>
              <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
                <ActivityIndicator color={colors.brand} size="small" />
                <Text style={styles.typingText}>{t("assistant.findingCode")}</Text>
              </View>
            </View>
          )}

          {/* Smart follow-up questions after an answer */}
          {!busy && !showIntro && followUps.length > 0 && (
            <View style={styles.followWrap}>
              <Text style={styles.suggTitle}>{t("assistant.youMightAsk")}</Text>
              {followUps.map((s) => (
                <Pressable key={s} testID={`followup-${s.slice(0, 12)}`} style={styles.suggChip} onPress={() => send(s)}>
                  <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.brand} />
                  <Text style={styles.suggText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Intro suggestions with shuffle */}
          {showIntro && (
            <View style={styles.suggWrap}>
              <View style={styles.suggHead}>
                <Text style={styles.suggTitle}>{activeCategory ? t("assistant.tryAskingCat", { category: activeCategory.label }) : t("assistant.tryAsking")}</Text>
                <Pressable testID="shuffle-suggestions" onPress={shuffle} style={styles.diceBtn} hitSlop={8}>
                  <Ionicons name="dice" size={18} color={colors.brand} />
                  <Text style={styles.diceText}>{t("assistant.shuffle")}</Text>
                </Pressable>
              </View>
              {suggestions.map((s) => (
                <Pressable key={s} testID={`suggestion-${s.slice(0, 12)}`} style={styles.suggChip} onPress={() => send(s)}>
                  <Ionicons name="help-circle-outline" size={16} color={colors.brand} />
                  <Text style={styles.suggText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom || spacing.md }]}>
          <TextInput
            testID="assistant-input"
            value={input}
            onChangeText={setInput}
            placeholder={recording ? t("assistant.listening") : t("assistant.inputPlaceholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send()}
          />
          <Pressable testID="assistant-mic" onPress={onMic} style={[styles.micBtn, recording && styles.micBtnActive]}>
            {transcribing ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name={recording ? "stop" : "mic"} size={20} color={recording ? colors.onBrand : colors.brand} />}
          </Pressable>
          <Pressable testID="assistant-send" style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.5 }]} onPress={() => send()} disabled={!input.trim() || busy}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrand} />
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>{t("assistant.disclaimer")}</Text>
      </KeyboardAvoidingView>

      {/* Attach code to invoice sheet */}
      <Modal visible={!!attach} transparent animationType="slide" onRequestClose={() => setAttach(null)}>
        <View style={styles.attachWrap}>
          <View style={styles.attachSheet} testID="attach-sheet">
            <View style={styles.attachHandle} />
            <Text style={styles.attachTitle}>{t("assistant.attachTitle")}</Text>
            <Text style={styles.attachCode} numberOfLines={2}>{attach?.code} · {attach?.name}</Text>
            <Text style={styles.attachHint}>{t("assistant.attachSub")}</Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Active shift: highlighted target */}
              {activeShift && (
                <>
                  <Text style={styles.attachGroup}>{t("assistant.activeShiftGroup")}</Text>
                  <Pressable
                    testID="attach-active-shift"
                    style={[styles.attachRow, styles.attachRowActive]}
                    onPress={attachToActiveShift}
                    disabled={!!attachBusy}
                  >
                    <View style={[styles.attachIcon, { backgroundColor: colors.success + "33" }]}>
                      <Ionicons name="flash" size={18} color={colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.attachRowText, { color: colors.success }]}>
                        {(activeShift.invoices || []).length > 0
                          ? t("assistant.activeShiftAdd")
                          : t("assistant.activeShiftCreate")}
                      </Text>
                      <Text style={styles.attachShift} numberOfLines={1}>
                        {(activeShift.invoices || []).length > 0
                          ? t("assistant.activeShiftDraftLbl", {
                              number: activeShift.invoices[0].invoice_number,
                              client: activeShift.invoices[0].client_name || "—",
                            })
                          : t("assistant.activeShiftNewLbl")}
                      </Text>
                    </View>
                    {attachBusy === "shift"
                      ? <ActivityIndicator size="small" color={colors.success} />
                      : <Ionicons name="chevron-forward" size={16} color={colors.success} />}
                  </Pressable>
                </>
              )}

              {/* Existing unpaid draft invoices (excluding shift-linked) */}
              {drafts.length > 0 && (
                <>
                  <Text style={styles.attachGroup}>{t("assistant.draftsGroup")}</Text>
                  {drafts.map((inv) => (
                    <Pressable key={inv.id} testID={`attach-inv-${inv.id}`} style={styles.attachRow} onPress={() => attachTo(inv)} disabled={!!attachBusy}>
                      <View style={[styles.attachIcon, { backgroundColor: colors.warning + "22" }]}>
                        <Ionicons name="document-text" size={16} color={colors.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attachRowText}>{inv.invoice_number} · {inv.client_name || "—"}</Text>
                        <Text style={styles.attachShiftMuted}>{new Date(inv.issue_date || inv.created_at || Date.now()).toLocaleDateString("en-AU")}</Text>
                      </View>
                      {attachBusy === inv.id ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
                    </Pressable>
                  ))}
                </>
              )}

              {/* Start fresh */}
              <Text style={styles.attachGroup}>{t("assistant.newInvoiceGroup")}</Text>
              <Pressable testID="attach-new-invoice" style={styles.attachRow} onPress={() => newInvoiceWith(attach)}>
                <View style={[styles.attachIcon, { backgroundColor: colors.brand + "22" }]}><Ionicons name="add" size={18} color={colors.brand} /></View>
                <Text style={[styles.attachRowText, { flex: 1 }]}>{t("assistant.newInvoice")}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>

              {!activeShift && drafts.length === 0 && <Text style={styles.attachEmpty}>{t("assistant.noDrafts")}</Text>}
            </ScrollView>

            <Pressable testID="attach-cancel" onPress={() => setAttach(null)} style={{ alignItems: "center", padding: spacing.md }}>
              <Text style={{ color: colors.muted, fontWeight: weight.bold }}>{t("common.cancel")}</Text>
            </Pressable>
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
  headerCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  aiDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  catBar: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surfaceSecondary + "60" },
  catChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  catChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  catChipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  bubbleRow: { marginBottom: spacing.md },
  rowLeft: { alignItems: "flex-start" },
  rowRight: { alignItems: "flex-end" },
  bubble: { maxWidth: "88%", borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  aiBubble: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 4 },
  userBubble: { backgroundColor: colors.brand, borderTopRightRadius: 4 },
  bubbleText: { color: colors.onSurface, fontSize: 15, lineHeight: 21 },
  typing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  typingText: { color: colors.muted, fontSize: 13 },
  codeList: { marginTop: spacing.sm, gap: spacing.sm, alignSelf: "stretch" },
  codeChip: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.brand + "55" },
  codeNum: { color: colors.brand, fontSize: 13, fontWeight: weight.heavy },
  codeName: { color: colors.onSurface, fontSize: 13, marginTop: 2 },
  codeRate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  useBtn: { alignItems: "center", gap: 2 },
  useText: { color: colors.brand, fontSize: 11, fontWeight: weight.bold },
  suggWrap: { marginTop: spacing.md, gap: spacing.sm },
  followWrap: { marginTop: spacing.xs, marginBottom: spacing.md, gap: spacing.sm },
  suggHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  suggTitle: { color: colors.muted, fontSize: 12, fontWeight: weight.bold, letterSpacing: 0.5 },
  diceBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  diceText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  suggChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  suggText: { color: colors.onSurfaceTertiary, fontSize: 14, flex: 1 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  micBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  micBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  disclaimer: { color: colors.muted, fontSize: 11, textAlign: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface },
  attachWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  attachSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  attachHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  attachTitle: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  attachCode: { color: colors.brand, fontSize: 13, fontWeight: weight.bold, marginTop: 2, marginBottom: spacing.xs },
  attachHint: { color: colors.muted, fontSize: 12, marginBottom: spacing.md },
  attachGroup: { color: colors.muted, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.xs },
  attachRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  attachRowActive: { borderColor: colors.success + "88", backgroundColor: colors.success + "14" },
  attachIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  attachRowText: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  attachShift: { color: colors.success, fontSize: 11, fontWeight: weight.bold, marginTop: 1 },
  attachShiftMuted: { color: colors.muted, fontSize: 11, marginTop: 1 },
  attachEmpty: { color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: spacing.sm },
});
