import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Platform, ActivityIndicator, Alert, Linking,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { api, toDMY } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { capturePhoto, pickPhoto } from "@/src/photos";
import { useConfirm } from "@/src/components/Celebration";
import { useTranslation } from "react-i18next";

const TYPES = ["Certificate", "Insurance", "License"];
const TYPE_ICON: Record<string, any> = { Certificate: "ribbon", Insurance: "shield-checkmark", License: "card" };

function expiryStatus(expiry: string | undefined, t: (k: string, o?: any) => string) {
  if (!expiry) return { label: t("credentials.noExpiry"), color: colors.muted };
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (expiry < today) return { label: t("credentials.expired"), color: colors.error };
  if (days <= 30) return { label: t("credentials.expiresIn", { days }), color: colors.warning };
  return { label: t("credentials.validExp", { date: toDMY(expiry) }), color: colors.success };
}

export default function Credentials() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Certificate");
  const [issuer, setIssuer] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [photo, setPhoto] = useState("");
  const [fileType, setFileType] = useState("image"); // image | pdf
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewImage, setViewImage] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.listCredentials()); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reset = () => { setTitle(""); setType("Certificate"); setIssuer(""); setNumber(""); setExpiry(""); setPhoto(""); setFileType("image"); setFileName(""); };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setPhoto(b64);
      const isPdf = (asset.mimeType || "").includes("pdf") || (asset.name || "").toLowerCase().endsWith(".pdf");
      setFileType(isPdf ? "pdf" : "image");
      setFileName(asset.name || (isPdf ? "document.pdf" : "image.jpg"));
    } catch (e: any) {
      Alert.alert("Couldn't attach file", e?.message || "Please try again.");
    }
  };

  const openPdf = async (c: any) => {
    try {
      const safe = (c.file_name || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${FileSystem.cacheDirectory}${safe}`;
      await FileSystem.downloadAsync(c.image_url, path);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: c.title });
      } else {
        await Linking.openURL(path);
      }
    } catch (e: any) {
      Alert.alert("Cannot open document", e?.message || "Unable to open this PDF.");
    }
  };

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createCredential({ title, type, issuer, number, expiry_date: expiry, image_base64: photo, file_type: fileType, file_name: fileName });
      reset(); setModal(false); confirm(t("credentials.saved")); load();
    } catch (e: any) {
      Alert.alert("Couldn't save document", e?.message || "Something went wrong. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.container} testID="credentials-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("credentials.title")}</Text>
        <Pressable testID="add-credential-btn" onPress={() => setModal(true)} style={styles.iconBtn}>
          <Ionicons name="add" size={26} color={colors.brand} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t("credentials.intro")}</Text>
          {items.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>{t("credentials.empty")}</Text>
            </View>
          )}
          {TYPES.map((ty) => {
            const group = items.filter((i) => i.type === ty);
            if (group.length === 0) return null;
            return (
              <View key={ty} style={{ marginBottom: spacing.lg }}>
                <Text style={styles.groupLabel}>{t(`credentials.${ty.toLowerCase()}`).toUpperCase()} · {group.length}</Text>
                {group.map((c) => {
                  const st = expiryStatus(c.expiry_date, t);
                  const isPdf = c.file_type === "pdf";
                  const hasFile = !!c.image_url;
                  return (
                    <View key={c.id} style={styles.card} testID={`credential-${c.id}`}>
                      <Pressable
                        testID={`view-credential-${c.id}`}
                        disabled={!hasFile}
                        onPress={() => {
                          if (!hasFile) return;
                          if (isPdf) openPdf(c);
                          else setViewImage(c.image_url);
                        }}
                      >
                        {hasFile && !isPdf ? (
                          <View>
                            <Image source={{ uri: c.image_url }} style={styles.thumb} contentFit="cover" />
                            <View style={styles.thumbBadge}>
                              <Ionicons name="eye" size={11} color={colors.onBrand} />
                            </View>
                          </View>
                        ) : isPdf ? (
                          <View style={[styles.thumb, styles.thumbPdf]}>
                            <Ionicons name="document-text" size={24} color={colors.error} />
                            <Text style={styles.pdfTag}>PDF</Text>
                          </View>
                        ) : (
                          <View style={[styles.thumb, styles.thumbIcon]}>
                            <Ionicons name={TYPE_ICON[c.type] || "document"} size={22} color={colors.brand} />
                          </View>
                        )}
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{c.title}</Text>
                        {!!c.issuer && <Text style={styles.meta}>{c.issuer}</Text>}
                        {!!c.number && <Text style={styles.certNo}>{t("credentials.certNo", { n: c.number })}</Text>}
                        <View style={[styles.statusPill, { backgroundColor: st.color + "22" }]}>
                          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Pressable testID={`del-credential-${c.id}`} onPress={async () => { await api.deleteCredential(c.id); load(); }} style={{ padding: spacing.sm }}>
                        <Ionicons name="trash-outline" size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{t("credentials.addDoc")}</Text>
              <View style={styles.typeRow}>
                {TYPES.map((ty) => (
                  <Pressable key={ty} testID={`credtype-${ty}`} onPress={() => setType(ty)} style={[styles.typeChip, type === ty && styles.typeChipActive]}>
                    <Text style={[styles.typeChipText, type === ty && { color: colors.onBrand }]}>{t(`credentials.${ty.toLowerCase()}`)}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput testID="cred-title" value={title} onChangeText={setTitle} placeholder={t("credentials.titlePlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="cred-issuer" value={issuer} onChangeText={setIssuer} placeholder={t("credentials.issuerPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="cred-number" value={number} onChangeText={setNumber} placeholder={t("credentials.numberPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput testID="cred-expiry" value={expiry} onChangeText={setExpiry} placeholder={t("credentials.expiryPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.photoRow}>
                <Pressable testID="cred-camera" style={styles.photoBtn} onPress={async () => { const p = await capturePhoto(); if (p) { setPhoto(p); setFileType("image"); setFileName("photo.jpg"); } }}>
                  <Ionicons name="camera" size={18} color={colors.brand} />
                  <Text style={styles.photoBtnText}>{t("credentials.photo")}</Text>
                </Pressable>
                <Pressable testID="cred-gallery" style={styles.photoBtn} onPress={async () => { const p = await pickPhoto(); if (p) { setPhoto(p); setFileType("image"); setFileName("image.jpg"); } }}>
                  <Ionicons name="image" size={18} color={colors.brand} />
                  <Text style={styles.photoBtnText}>{t("credentials.gallery")}</Text>
                </Pressable>
                <Pressable testID="cred-file" style={styles.photoBtn} onPress={pickDocument}>
                  <Ionicons name="document-attach" size={18} color={colors.brand} />
                  <Text style={styles.photoBtnText}>{t("credentials.pdfFile")}</Text>
                </Pressable>
              </View>
              {!!photo && fileType === "pdf" && (
                <View style={styles.pdfPreview} testID="cred-pdf-preview">
                  <Ionicons name="document-text" size={22} color={colors.error} />
                  <Text style={styles.pdfPreviewText} numberOfLines={1}>{fileName || "document.pdf"}</Text>
                  <Pressable onPress={() => { setPhoto(""); setFileType("image"); setFileName(""); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                </View>
              )}
              {!!photo && fileType !== "pdf" && <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.preview} contentFit="cover" />}
              <Pressable testID="save-credential-btn" style={styles.primaryBtn} onPress={add} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>{t("credentials.saveDoc")}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage("")}>
        <Pressable style={styles.imageModal} onPress={() => setViewImage("")} testID="credential-image-modal">
          <Text style={styles.imageModalHint}>{t("credentials.tapClose")}</Text>
          {!!viewImage && <Image source={{ uri: viewImage }} style={styles.fullImage} contentFit="contain" />}
        </Pressable>
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
  groupLabel: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, letterSpacing: 1, marginBottom: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: radius.md },
  thumbBadge: { position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surfaceSecondary },
  thumbIcon: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  thumbPdf: { backgroundColor: colors.error + "1A", alignItems: "center", justifyContent: "center" },
  pdfTag: { color: colors.error, fontSize: 9, fontWeight: weight.bold, marginTop: 2, letterSpacing: 0.5 },
  pdfPreview: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  pdfPreviewText: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  certNo: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginTop: 2 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, marginTop: spacing.xs },
  statusText: { fontSize: 11, fontWeight: weight.bold },
  empty: { alignItems: "center", marginTop: spacing.xl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: 14 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  typeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  typeChip: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChipText: { color: colors.onSurfaceTertiary, fontWeight: weight.bold, fontSize: 13 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  photoRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, borderStyle: "dashed" },
  photoBtnText: { color: colors.brand, fontWeight: weight.bold },
  preview: { width: "100%", height: 140, borderRadius: radius.md, marginTop: spacing.md },
  primaryBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  imageModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  imageModalHint: { color: colors.muted, marginBottom: spacing.md, fontSize: 13 },
  fullImage: { width: "100%", height: "80%" },
});
