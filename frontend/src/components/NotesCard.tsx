import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useVoice } from "@/src/useVoice";
import { useConfirm } from "@/src/components/Celebration";
import { ClientAvatar } from "@/src/components/ClientAvatar";

const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
const hasHtml = (s = "") => /<[a-z][\s\S]*>/i.test(s);

export function NotesCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const date = new Date().toISOString().slice(0, 10);
  const { recording, transcribing, start, stop } = useVoice();
  const [note, setNote] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [savingClient, setSavingClient] = useState("");
  const lastTap = useRef(0);
  const tapTimer = useRef<any>(null);

  const load = useCallback(async () => {
    try { setNote(await api.getNote(date)); } catch {}
  }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openPicker = async () => {
    const text = stripHtml(note?.text);
    if (!text) { confirm(t("notes.emptyNote")); return; }
    try {
      const list = await api.listClients();
      setClients(list || []);
    } catch { setClients([]); }
    setPickerOpen(true);
  };

  const saveToClient = async (client: any) => {
    setSavingClient(client.id);
    try {
      await api.addClientNote(client.id, { text: stripHtml(note?.text), date });
      setPickerOpen(false);
      // Clear today's note now that it lives on the client profile.
      await persist({ text: "" });
      confirm(t("notes.savedToClient", { name: client.name }));
    } finally { setSavingClient(""); }
  };

  const persist = async (patch: any) => {
    const next = { ...note, ...patch };
    setNote(next);
    setSaving(true);
    try {
      await api.putNote(date, {
        text: next.text, font: next.font, font_size: next.font_size,
        text_color: next.text_color, bg_color: next.bg_color, photos: next.photos || [],
      });
    } finally { setSaving(false); }
  };

  const onMic = async () => {
    if (recording) {
      const t = await stop();
      if (t) await persist({ text: note?.text ? `${note.text} ${t}` : t });
    } else { await start(); }
  };

  // Single tap => expand inline (plain notes) or open full editor (rich notes);
  // double tap => always open full-screen editor.
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      router.push("/notes");
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      if (hasHtml(note?.text)) router.push("/notes");
      else setExpanded((e) => !e);
    }, 290);
  };

  const preview = stripHtml(note?.text);

  return (
    <View style={styles.card} testID="notes-card">
      <View style={styles.headRow}>
        <View style={styles.titleRow}>
          <Ionicons name="reader" size={16} color={colors.brand} />
          <Text style={styles.title}>{t("notes.title")}</Text>
          {saving && <ActivityIndicator size="small" color={colors.muted} style={{ marginLeft: 6 }} />}
        </View>
        <View style={styles.actions}>
          <Pressable testID="notes-save-client-btn" onPress={openPicker} style={styles.recBtn}>
            <Ionicons name="person-add" size={16} color={colors.brand} />
            <Text style={styles.recText}>{t("notes.saveToClient")}</Text>
          </Pressable>
          <Pressable testID="notes-record-btn" onPress={onMic} style={[styles.recBtn, recording && styles.recActive]}>
            {transcribing ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <>
                <Ionicons name={recording ? "stop" : "mic"} size={16} color={recording ? colors.onBrand : colors.brand} />
                <Text style={[styles.recText, recording && { color: colors.onBrand }]}>{recording ? t("notes.stop") : t("notes.record")}</Text>
              </>
            )}
          </Pressable>
          <Pressable testID="notes-fullscreen-btn" onPress={() => router.push("/notes")} style={styles.expandBtn}>
            <Ionicons name="expand" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <View style={styles.expandedWrap}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator>
            <TextInput
              testID="notes-inline-input"
              value={note?.text || ""}
              onChangeText={(t) => setNote((n: any) => ({ ...n, text: t }))}
              onEndEditing={() => persist({ text: note?.text || "" })}
              multiline
              placeholder={t("notes.inlinePlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.inlineInput}
            />
          </ScrollView>
          <View style={styles.expandedActions}>
            <Pressable testID="notes-clear-btn" onPress={() => persist({ text: "" })}>
              <Text style={styles.clearText}>{t("notes.clear")}</Text>
            </Pressable>
            <Pressable testID="notes-open-editor" onPress={() => router.push("/notes")}>
              <Text style={styles.openText}>{t("notes.openEditor")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable testID="notes-preview" onPress={handleTap}>
          {preview ? (
            <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
          ) : (
            <Text style={styles.placeholder}>{t("notes.placeholder")}</Text>
          )}
          <Text style={styles.hint}>{t("notes.hint")}</Text>
        </Pressable>
      )}

      {/* Client picker to attach today's note */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalWrap} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("notes.pickClientTitle")}</Text>
            <Text style={styles.sheetSub}>{t("notes.pickClientSub")}</Text>
            {clients.length === 0 ? (
              <Text style={styles.emptyClients}>{t("notes.noClients")}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator>
                {clients.map((c) => (
                  <Pressable
                    key={c.id}
                    testID={`notes-client-${c.id}`}
                    style={styles.clientRow}
                    onPress={() => saveToClient(c)}
                    disabled={!!savingClient}
                  >
                    <ClientAvatar name={c.name} color={c.color} icon={c.icon} photo={c.photo_base64} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName}>{c.name}</Text>
                      {!!c.ndis_number && <Text style={styles.clientMeta}>{c.ndis_number}</Text>}
                    </View>
                    {savingClient === c.id ? (
                      <ActivityIndicator size="small" color={colors.brand} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  recBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  recActive: { backgroundColor: colors.brand },
  recText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  expandBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  preview: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20 },
  placeholder: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 11, marginTop: spacing.sm, opacity: 0.7 },
  expandedWrap: { gap: spacing.sm },
  inlineInput: { color: colors.onSurface, fontSize: 15, lineHeight: 22, minHeight: 120, textAlignVertical: "top" },
  expandedActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  clearText: { color: colors.error, fontWeight: weight.bold, fontSize: 13 },
  openText: { color: colors.brand, fontWeight: weight.bold, fontSize: 13 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  sheetSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2, marginBottom: spacing.md },
  emptyClients: { color: colors.muted, fontSize: 14, paddingVertical: spacing.lg, textAlign: "center" },
  clientRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  clientName: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  clientMeta: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
