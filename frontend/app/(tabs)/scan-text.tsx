import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput,
  Platform, Alert, Share, useWindowDimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { api } from "@/src/api";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useCelebration } from "@/src/components/Celebration";

type Stage = "capture" | "preview" | "extracting" | "result";
type FlashMode = "off" | "on" | "auto";

const DESKTOP_BREAKPOINT = 768;

// General-purpose "photograph anything, get editable text back" flow —
// deliberately separate from the Receipt Scanner (structured financial
// fields) and the Document Scanner mode inside it (structured metadata tied
// to a specific client). This screen produces one thing: plain editable
// text the user can correct and save under their own title, for letters,
// forms, notices, meeting notes or any other printed page.
export default function ScanText() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const celebrate = useCelebration();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [flashMode, setFlashMode] = useState<FlashMode>("off");

  const [stage, setStage] = useState<Stage>("capture");
  const [imageB64, setImageB64] = useState("");
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same fix as the Receipt Scanner: hide the global bottom tab bar while
  // this screen (camera or review) is focused, restore it on the way out.
  // This screen is a direct child of the Tabs navigator (no intermediate
  // Stack), so `tabBarStyle` is set on this screen's own navigation object.
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => navigation.setOptions({ tabBarStyle: undefined });
    }, [navigation])
  );

  const cycleFlash = () => {
    setFlashMode((m) => (m === "off" ? "on" : m === "on" ? "auto" : "off"));
  };

  const capture = async () => {
    if (!camRef.current) return;
    setError(null);
    try {
      const photo = await camRef.current.takePictureAsync({ base64: true, quality: 0.6, skipProcessing: true });
      if (!photo?.base64) throw new Error("Capture failed");
      setImageB64(photo.base64);
      setStage("preview");
    } catch (e: any) {
      setError(e?.message || t("cameraText.captureError"));
    }
  };

  const retake = () => {
    setImageB64("");
    setText("");
    setTitle("");
    setConfidence(0);
    setError(null);
    setStage("capture");
  };

  const extract = async () => {
    setError(null);
    setStage("extracting");
    try {
      const res = await api.scanText(imageB64);
      const d = res.data || {};
      setText(d.text || "");
      setConfidence(d.confidence || 0);
      setStage("result");
    } catch (e: any) {
      setError(e?.message || t("cameraText.readError"));
      setStage("preview");
    }
  };

  const copyText = async () => {
    await Clipboard.setStringAsync(text);
    celebrate(t("cameraText.copied"));
  };

  const shareText = async () => {
    try { await Share.share({ message: text, title: title || t("cameraText.title") }); } catch {}
  };

  const discard = () => {
    Alert.alert(t("cameraText.discardTitle"), t("cameraText.discardMsg"), [
      { text: t("cameraText.cancel"), style: "cancel" },
      { text: t("cameraText.discardConfirm"), style: "destructive", onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (!title.trim()) { setError(t("cameraText.titleRequired")); return; }
    setError(null);
    setSaving(true);
    try {
      await api.createTextDocument({ title: title.trim(), text, doc_type: "Document", image_base64: imageB64 });
      celebrate(t("cameraText.saved"), { sound: true });
      router.back();
    } catch (e: any) {
      setError(e?.message || t("cameraText.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (stage === "capture") {
    if (!permission) return <View style={styles.container} />;
    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.center]} testID="scan-text-screen">
          <Ionicons name="document-text" size={54} color={colors.brand} />
          <Text style={styles.permTitle}>{t("cameraText.permTitle")}</Text>
          <Text style={styles.permText}>{t("cameraText.permText")}</Text>
          <Pressable testID="grant-camera-btn" style={[styles.primaryBtn, styles.permBtn]} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>{t("cameraText.enableCamera")}</Text>
          </Pressable>
          <Pressable testID="scan-text-back-noperm" onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>{t("cameraText.cancel")}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container} testID="scan-text-screen">
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" flash={flashMode} />
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
            <Pressable testID="scan-text-cancel" onPress={() => router.back()} style={styles.roundBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.scanTitle}>{t("cameraText.title")}</Text>
              <Text style={styles.scanHint}>{t("cameraText.hint")}</Text>
            </View>
            <Pressable testID="scan-text-flash" onPress={cycleFlash} style={styles.roundBtn} hitSlop={8}>
              <Ionicons name={flashMode === "off" ? "flash-off" : flashMode === "on" ? "flash" : "flash-outline"} size={20} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.lg }]}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable testID="scan-text-capture-btn" style={styles.shutter} onPress={capture}>
              <View style={styles.shutterInner}>
                <Ionicons name="document-text" size={28} color={colors.onBrand} />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // preview / extracting / result share one scrollable screen with a
  // consistent header so users always know how to get back or start over.
  return (
    <View style={styles.reviewContainer} testID="scan-text-screen">
      <View style={[styles.reviewHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="scan-text-back" onPress={stage === "result" ? discard : retake} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.reviewHeaderTitle}>
          {stage === "result" ? t("cameraText.resultTitle") : t("cameraText.title")}
        </Text>
        {stage === "result" ? (
          <View style={styles.confBadge}>
            <Ionicons name="sparkles" size={12} color={colors.success} />
            <Text style={styles.confText}>AI {Math.round(confidence * 100)}%</Text>
          </View>
        ) : <View style={{ width: 40 }} />}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {stage === "extracting" ? (
            <View style={styles.extractingWrap}>
              <Image source={{ uri: `data:image/jpeg;base64,${imageB64}` }} style={styles.previewImageSmall} contentFit="cover" />
              <ActivityIndicator color={colors.brand} size="large" style={{ marginTop: spacing.xl }} />
              <Text style={styles.extractingText}>{t("cameraText.reading")}</Text>
            </View>
          ) : (
            <View style={isDesktop ? styles.desktopRow : undefined}>
              <View style={isDesktop ? styles.desktopImageCol : undefined}>
                {stage === "result" && <Text style={styles.fieldLabel}>{t("cameraText.originalImage")}</Text>}
                {imageB64 ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${imageB64}` }}
                    style={isDesktop ? styles.previewImageDesktop : styles.previewImage}
                    contentFit="contain"
                  />
                ) : null}

                {stage === "preview" && (
                  <View style={styles.previewActions}>
                    {!!error && <Text style={styles.error}>{error}</Text>}
                    <Pressable testID="scan-text-retake" style={styles.ghostBtn} onPress={retake}>
                      <Ionicons name="camera-reverse-outline" size={16} color={colors.onSurfaceTertiary} />
                      <Text style={styles.ghostText}>  {t("cameraText.retake")}</Text>
                    </Pressable>
                    <Pressable testID="scan-text-extract" style={styles.primaryBtn} onPress={extract}>
                      <Ionicons name="sparkles" size={16} color={colors.onBrand} />
                      <Text style={styles.primaryBtnText}>  {t("cameraText.extractText")}</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {stage === "result" && (
                <View style={isDesktop ? styles.desktopTextCol : undefined}>
                  <Text style={styles.reviewNotice}>{t("cameraText.reviewNotice")}</Text>
                  {!text.trim() && <Text style={styles.warningText}>{t("cameraText.emptyTextWarning")}</Text>}

                  <Text style={styles.fieldLabel}>{t("cameraText.docTitleLabel")}</Text>
                  <TextInput
                    testID="scan-text-doc-title"
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t("cameraText.docTitlePlaceholder")}
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />

                  <Text style={styles.fieldLabel}>{t("cameraText.resultTitle")}</Text>
                  <TextInput
                    testID="scan-text-editor"
                    value={text}
                    onChangeText={setText}
                    placeholder={t("cameraText.textPlaceholder")}
                    placeholderTextColor={colors.muted}
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textEditor, isDesktop && styles.textEditorDesktop]}
                  />

                  {!!error && <Text style={styles.error}>{error}</Text>}

                  <Pressable testID="scan-text-save" style={[styles.primaryBtn, styles.fullBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="save" size={16} color={colors.onBrand} /><Text style={styles.primaryBtnText}>  {t("cameraText.save")}</Text></>)}
                  </Pressable>

                  <View style={styles.sheetActions}>
                    <Pressable testID="scan-text-copy" style={styles.ghostBtn} onPress={copyText}>
                      <Ionicons name="copy-outline" size={16} color={colors.onSurfaceTertiary} />
                      <Text style={styles.ghostText}>  {t("cameraText.copyText")}</Text>
                    </Pressable>
                    {Platform.OS !== "web" && (
                      <Pressable testID="scan-text-share" style={styles.ghostBtn} onPress={shareText}>
                        <Ionicons name="share-outline" size={16} color={colors.onSurfaceTertiary} />
                        <Text style={styles.ghostText}>  {t("cameraText.share")}</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.sheetActions}>
                    <Pressable testID="scan-text-retake-2" style={styles.ghostBtn} onPress={retake}>
                      <Ionicons name="camera-reverse-outline" size={16} color={colors.onSurfaceTertiary} />
                      <Text style={styles.ghostText}>  {t("cameraText.retake")}</Text>
                    </Pressable>
                    <Pressable testID="scan-text-discard" style={[styles.ghostBtn, { borderColor: colors.error + "77" }]} onPress={discard}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                      <Text style={[styles.ghostText, { color: colors.error }]}>  {t("cameraText.discard")}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface },
  permTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy },
  permText: { color: colors.muted, textAlign: "center" },
  permBtn: { flex: 0, alignSelf: "center", width: 220, marginTop: spacing.md },
  backLink: { marginTop: spacing.sm, padding: spacing.sm },
  backLinkText: { color: colors.muted, fontWeight: weight.bold },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  scanTitle: { color: "#fff", fontSize: 18, fontWeight: weight.heavy },
  scanHint: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  frame: { alignSelf: "center", width: "82%", aspectRatio: 0.75, position: "relative", alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 34, height: 34, borderColor: colors.brand },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  bottomBar: { alignItems: "center", paddingTop: spacing.lg, gap: spacing.md },
  errorText: { color: colors.error, textAlign: "center", paddingHorizontal: spacing.xl },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },

  reviewContainer: { flex: 1, backgroundColor: colors.surface },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  reviewHeaderTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  confBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success + "22", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  confText: { color: colors.success, fontSize: 12, fontWeight: weight.bold },

  extractingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing.xxl },
  previewImageSmall: { width: "70%", aspectRatio: 0.75, borderRadius: radius.md },
  extractingText: { color: colors.brand, fontWeight: weight.bold, marginTop: spacing.md },

  desktopRow: { flexDirection: "row", gap: spacing.xl, alignItems: "flex-start" },
  desktopImageCol: { flex: 1 },
  desktopTextCol: { flex: 1.2 },

  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  previewImage: { width: "100%", aspectRatio: 0.78, borderRadius: radius.md, marginBottom: spacing.md, backgroundColor: colors.surfaceTertiary },
  previewImageDesktop: { width: "100%", height: 420, borderRadius: radius.md, marginBottom: spacing.md, backgroundColor: colors.surfaceTertiary },
  previewActions: { gap: spacing.md },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  reviewNotice: { color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.md },
  warningText: { color: colors.warning, fontSize: 13, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  textEditor: { minHeight: 220 },
  textEditorDesktop: { minHeight: 380 },
  ghostBtn: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  ghostText: { color: colors.onSurfaceTertiary, fontWeight: weight.bold, fontSize: 15 },
  primaryBtn: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  fullBtn: { width: "100%", marginBottom: spacing.md },
  primaryBtnText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  sheetActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
