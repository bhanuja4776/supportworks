import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Platform, ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, weight } from "@/src/theme";
import { VoiceField } from "@/src/components/VoiceField";
import { api } from "@/src/api";
import { shareProgressReportPdf } from "@/src/pdf/progressReportPdf";
import { useCelebration } from "@/src/components/Celebration";
import { useTranslation } from "react-i18next";

const TEMPLATES = [
  { key: "invoice", tk: "invoice", icon: "document-text", tint: colors.brand },
  { key: "report", tk: "report", icon: "clipboard", tint: colors.success },
  { key: "expense", tk: "expense", icon: "grid", tint: colors.warning },
];

export default function Templates() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const celebrate = useCelebration();
  const { t } = useTranslation();
  const [reportModal, setReportModal] = useState(false);
  const [client, setClient] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");

  const openTemplate = async (key: string) => {
    if (key === "invoice") { router.push("/invoice/new"); return; }
    if (key === "report") { setReportModal(true); return; }
    if (key === "expense") {
      setBusy("expense");
      try { await api.exportReceiptsXlsx(); } catch {} finally { setBusy(""); }
    }
  };

  // DOCX generation had no client-side path without adding a DOCX-writing
  // dependency, so it's explicitly deferred (see progressReportPdf.ts) —
  // only "pdf" is reachable from the UI now (the Word button is removed).
  const generateReport = async () => {
    setBusy("report");
    try {
      await shareProgressReportPdf({ title: "Progress Report", client_name: client, date, body });
      setReportModal(false);
      setClient(""); setBody("");
      celebrate(t("templates.reportGenerated"));
    } catch {} finally { setBusy(""); }
  };

  return (
    <View style={styles.container} testID="templates-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("templates.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t("templates.intro")}</Text>
        {TEMPLATES.map((tpl) => (
          <Pressable key={tpl.key} testID={`template-${tpl.key}`} style={styles.card} onPress={() => openTemplate(tpl.key)} disabled={!!busy}>
            <View style={[styles.icon, { backgroundColor: tpl.tint + "22", borderColor: tpl.tint + "55" }]}>
              {busy === tpl.key ? <ActivityIndicator size="small" color={tpl.tint} /> : <Ionicons name={tpl.icon as any} size={24} color={tpl.tint} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t(`templates.${tpl.tk}Title`)}</Text>
              <Text style={styles.cardDesc}>{t(`templates.${tpl.tk}Desc`)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={reportModal} transparent animationType="slide" onRequestClose={() => setReportModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("templates.reportTitle")}</Text>
            <TextInput testID="report-client" value={client} onChangeText={setClient} placeholder={t("templates.participantName")} placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput testID="report-date" value={date} onChangeText={setDate} placeholder={t("templates.datePlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
            <VoiceField label={t("templates.reportLabel")} value={body} onChangeText={setBody} placeholder={t("templates.dictatePlaceholder")} multiline testID="report-body" />
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <Pressable testID="generate-report-btn" style={[styles.primaryBtn, { flex: 1 }]} onPress={() => generateReport()} disabled={!!busy}>
                {busy === "report" ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="document-outline" size={18} color={colors.onBrand} /><Text style={styles.primaryText}>{t("templates.pdf")}</Text></>)}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  intro: { color: colors.muted, fontSize: 14, marginBottom: spacing.lg },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  icon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold },
  cardDesc: { color: colors.muted, fontSize: 13, marginTop: 2 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  docxBtn: { flex: 1, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
});
