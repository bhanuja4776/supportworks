import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, ScrollView, TextInput, Platform, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useCelebration } from "@/src/components/Celebration";

const CATEGORIES = ["Fuel", "Meals", "Supplies", "Equipment", "Travel", "Utilities", "General"];
const DOC_TYPES: [string, string][] = [
  ["Service Agreement", "docTypeServiceAgreement"],
  ["Consent", "docTypeConsent"],
  ["Plan", "docTypePlan"],
  ["Document", "docTypeDocument"],
];

type Mode = "receipt" | "document";

export default function Scan() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const celebrate = useCelebration();
  const navigation = useNavigation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  // The camera preview and shutter button need the full screen — hide the
  // global bottom tab bar while this screen is focused so it can't overlap
  // the capture area or controls, and restore it on the way out. This screen
  // is a direct child of the Tabs navigator (no intermediate Stack), so
  // `tabBarStyle` is set directly via this screen's own navigation object —
  // not `.getParent()`, which would reach past Tabs to the root Stack.
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => navigation.setOptions({ tabBarStyle: undefined });
    }, [navigation])
  );

  const [mode, setMode] = useState<Mode>("receipt");
  const [scanning, setScanning] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [data, setData] = useState<any>(null);
  const [docData, setDocData] = useState<any>(null);
  const [confidence, setConfidence] = useState(0);
  const [imageB64, setImageB64] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string>("");
  const [clients, setClients] = useState<any[]>([]);
  const [pickedClientId, setPickedClientId] = useState<string>("");

  useFocusEffect(useCallback(() => {
    api.activeShift().then((r) => setActiveShiftId(r?.shift?.id || "")).catch(() => {});
    api.listClients().then((c) => setClients(Array.isArray(c) ? c : [])).catch(() => {});
  }, []));

  const capture = async () => {
    if (!camRef.current || scanning) return;
    setError(null);
    setScanning(true);
    try {
      const photo = await camRef.current.takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true });
      if (!photo?.base64) throw new Error("Capture failed");
      setImageB64(photo.base64);
      if (mode === "receipt") {
        try {
          const res = await api.scanReceipt(photo.base64);
          const d = res.data || {};
          setData({
            merchant: d.merchant || "",
            abn: d.abn || "",
            receipt_number: d.receipt_number || "",
            date: d.date || new Date().toISOString().slice(0, 10),
            subtotal: d.subtotal ? String(d.subtotal) : "",
            total: d.total ? String(d.total) : "",
            gst: d.gst ? String(d.gst) : "",
            category: d.category || "General",
            payment_method: d.payment_method || "",
            line_items: Array.isArray(d.line_items) ? d.line_items.map((li: any) => ({
              description: li.description || "", qty: li.qty ? String(li.qty) : "",
              unit_price: li.unit_price ? String(li.unit_price) : "", gst_rate: li.gst_rate ? String(li.gst_rate) : "",
            })) : [],
          });
        } catch {
          // AI extraction failed (or no key configured) — fall back to a
          // blank, still-editable form rather than blocking the capture.
          setData({
            merchant: "", abn: "", receipt_number: "",
            date: new Date().toISOString().slice(0, 10),
            subtotal: "", total: "", gst: "", category: "General", payment_method: "", line_items: [],
          });
        }
      } else {
        const res = await api.scanDocument(photo.base64);
        const d = res.data || {};
        setConfidence(d.confidence || 0.9);
        setDocData({
          title: d.title || "",
          doc_type: DOC_TYPES.map(([k]) => k).includes(d.doc_type) ? d.doc_type : "Document",
          date: d.date || "",
          key_parties: Array.isArray(d.key_parties) ? d.key_parties.join(", ") : "",
          full_text: d.full_text || "",
        });
        setPickedClientId("");
      }
      setConfirmVisible(true);
    } catch (e: any) {
      setError(e?.message || (mode === "receipt" ? t("scan.readError") : t("scan.readErrorDoc")));
    } finally {
      setScanning(false);
    }
  };

  const saveReceipt = async (opts: { shift_id?: string; archived?: boolean }, msg: string) => {
    setSaving(true);
    try {
      await api.createReceipt({
        merchant: data.merchant,
        abn: data.abn || "",
        receipt_number: data.receipt_number || "",
        date: data.date,
        subtotal: parseFloat(data.subtotal) || 0,
        total: parseFloat(data.total) || 0,
        gst: parseFloat(data.gst) || 0,
        category: data.category,
        payment_method: data.payment_method,
        line_items: (data.line_items || [])
          .filter((li: any) => li.description?.trim() || li.qty || li.unit_price)
          .map((li: any) => ({
            description: li.description || "",
            qty: parseFloat(li.qty) || 0,
            unit_price: parseFloat(li.unit_price) || 0,
            gst_rate: parseFloat(li.gst_rate) || 0,
          })),
        image_base64: imageB64,
        shift_id: opts.shift_id || "",
        archived: !!opts.archived,
      });
      setConfirmVisible(false);
      setData(null);
      celebrate(msg, { sound: true });
    } catch (e: any) {
      setError(e?.message || t("scan.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const addLineItem = () => {
    setData((d: any) => ({
      ...d,
      line_items: [...(d.line_items || []), { description: "", qty: "", unit_price: "", gst_rate: "" }],
    }));
  };
  const updateLineItem = (idx: number, patch: any) => {
    setData((d: any) => ({
      ...d,
      line_items: (d.line_items || []).map((li: any, i: number) => (i === idx ? { ...li, ...patch } : li)),
    }));
  };
  const removeLineItem = (idx: number) => {
    setData((d: any) => ({ ...d, line_items: (d.line_items || []).filter((_: any, i: number) => i !== idx) }));
  };

  const saveDocument = async () => {
    if (!pickedClientId) {
      Alert.alert(t("scan.docPickClient"));
      return;
    }
    if (!docData?.title?.trim()) return;
    setSaving(true);
    try {
      const parties = String(docData.key_parties || "")
        .split(",").map((s: string) => s.trim()).filter(Boolean);
      await api.createClientDoc({
        client_id: pickedClientId,
        title: docData.title,
        type: docData.doc_type,
        file_base64: imageB64,
        extracted_text: docData.full_text || "",
        doc_date: docData.date || "",
        key_parties: parties,
      });
      const clientName = clients.find((c) => c.id === pickedClientId)?.name || "";
      setConfirmVisible(false);
      setDocData(null);
      setImageB64("");
      celebrate(t("scan.docSaved", { name: clientName }), { sound: true });
    } catch (e: any) {
      setError(e?.message || t("scan.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setConfirmVisible(false); setData(null); setDocData(null); setImageB64(""); setPickedClientId("");
  };

  if (!permission) {
    return <View style={styles.container} />;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]} testID="scan-screen">
        <Ionicons name="camera" size={54} color={colors.brand} />
        <Text style={styles.permTitle}>{t("scan.permTitle")}</Text>
        <Text style={styles.permText}>{t("scan.permText")}</Text>
        <Pressable testID="grant-camera-btn" style={[styles.primaryBtn, styles.permBtn]} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>{t("scan.enableCamera")}</Text>
        </Pressable>
      </View>
    );
  }

  const isDoc = mode === "document";

  return (
    <View style={styles.container} testID="scan-screen">
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
      {/* Frame guides */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <Pressable
              testID="mode-receipt"
              onPress={() => setMode("receipt")}
              style={[styles.modeChip, !isDoc && styles.modeChipOn]}
            >
              <Ionicons name="receipt" size={14} color={!isDoc ? colors.onBrand : "#fff"} />
              <Text style={[styles.modeChipText, !isDoc && styles.modeChipTextOn]}>{t("scan.modeReceipt")}</Text>
            </Pressable>
            <Pressable
              testID="mode-document"
              onPress={() => setMode("document")}
              style={[styles.modeChip, isDoc && styles.modeChipOn]}
            >
              <Ionicons name="document-text" size={14} color={isDoc ? colors.onBrand : "#fff"} />
              <Text style={[styles.modeChipText, isDoc && styles.modeChipTextOn]}>{t("scan.modeDocument")}</Text>
            </Pressable>
            <Pressable
              testID="mode-text"
              onPress={() => router.push("/(tabs)/scan-text" as any)}
              style={styles.modeChip}
            >
              <Ionicons name="text" size={14} color="#fff" />
              <Text style={styles.modeChipText}>{t("scan.modeText")}</Text>
            </Pressable>
          </View>
          <Text style={styles.scanTitle}>{isDoc ? t("scan.docScannerTitle") : t("scan.scannerTitle")}</Text>
          <Text style={styles.scanHint}>{isDoc ? t("scan.docScannerHint") : t("scan.scannerHint")}</Text>
        </View>
        <View style={[styles.frame, isDoc && styles.frameDoc]}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          {scanning && (
            <View style={styles.scanningHud}>
              <ActivityIndicator color={colors.brand} size="large" />
              <Text style={styles.scanningText}>{isDoc ? t("scan.readingDoc") : t("scan.reading")}</Text>
            </View>
          )}
        </View>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.lg }]}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Pressable testID="capture-btn" style={styles.shutter} onPress={capture} disabled={scanning}>
            <View style={styles.shutterInner}>
              <Ionicons name={isDoc ? "document-text" : "scan"} size={28} color={colors.onBrand} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Confirmation sheet */}
      <Modal visible={confirmVisible} transparent animationType="slide" onRequestClose={() => setConfirmVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <View style={styles.sheet} testID="confirm-sheet">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{isDoc ? t("scan.confirmDocTitle") : t("scan.confirmTitle")}</Text>
              {isDoc && (
                <View style={styles.confBadge}>
                  <Ionicons name="sparkles" size={12} color={colors.success} />
                  <Text style={styles.confText}>AI {Math.round(confidence * 100)}%</Text>
                </View>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              {imageB64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${imageB64}` }} style={styles.preview} contentFit="cover" />
              ) : null}

              {/* RECEIPT MODE */}
              {!isDoc && data && (
                <Animated.View entering={FadeInDown.duration(400).springify()}>
                  <Animated.View entering={FadeIn.delay(150)} style={styles.digitalHeader}>
                    <Ionicons name="image" size={14} color={colors.brand} />
                    <Text style={styles.digitalHeaderText}>{t("scan.manualEntryTitle")}</Text>
                  </Animated.View>
                  <Text style={styles.reviewNotice}>{t("scan.manualEntryNotice")}</Text>
                  <Field label={t("scan.merchant")} value={data.merchant} onChange={(v: string) => setData({ ...data, merchant: v })} testID="field-merchant" />
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.abn")} value={data.abn} onChange={(v: string) => setData({ ...data, abn: v })} placeholder={t("scan.abnPlaceholder")} testID="field-abn" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.receiptNumber")} value={data.receipt_number} onChange={(v: string) => setData({ ...data, receipt_number: v })} placeholder={t("scan.receiptNumberPlaceholder")} testID="field-receipt-number" />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.date")} value={data.date} onChange={(v: string) => setData({ ...data, date: v })} testID="field-date" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.subtotal")} value={data.subtotal} onChange={(v: string) => setData({ ...data, subtotal: v })} keyboard="decimal-pad" placeholder={t("scan.subtotalPlaceholder")} testID="field-subtotal" />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.gst")} value={data.gst} onChange={(v: string) => setData({ ...data, gst: v })} keyboard="decimal-pad" placeholder={t("scan.gstPlaceholder")} testID="field-gst" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.totalAud")} value={data.total} onChange={(v: string) => setData({ ...data, total: v })} keyboard="decimal-pad" testID="field-total" />
                    </View>
                  </View>
                  <Field label={t("scan.payment")} value={data.payment_method} onChange={(v: string) => setData({ ...data, payment_method: v })} testID="field-payment" />
                  <Text style={styles.fieldLabel}>{t("scan.category")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
                    {CATEGORIES.map((c) => (
                      <Pressable
                        key={c}
                        testID={`cat-${c}`}
                        onPress={() => setData({ ...data, category: c })}
                        style={[styles.chip, data.category === c && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, data.category === c && styles.chipTextActive]}>{c}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.itemsHeaderRow}>
                    <Text style={styles.fieldLabel}>{t("scan.lineItems")}</Text>
                    <Pressable testID="add-line-item" onPress={addLineItem} style={styles.addRowBtn} hitSlop={8}>
                      <Ionicons name="add-circle" size={16} color={colors.brand} />
                      <Text style={styles.addRowText}>{t("scan.addItem")}</Text>
                    </Pressable>
                  </View>
                  {(data.line_items || []).length === 0 ? (
                    <Text style={styles.emptyClients}>{t("scan.lineItemsEmpty")}</Text>
                  ) : (
                    (data.line_items || []).map((li: any, idx: number) => (
                      <View key={idx} style={styles.lineItemRow}>
                        <TextInput
                          testID={`line-item-desc-${idx}`}
                          value={li.description}
                          onChangeText={(v) => updateLineItem(idx, { description: v })}
                          placeholder={t("scan.itemDescription")}
                          placeholderTextColor={colors.muted}
                          style={[styles.input, styles.lineItemDesc]}
                        />
                        <TextInput
                          testID={`line-item-qty-${idx}`}
                          value={li.qty}
                          onChangeText={(v) => updateLineItem(idx, { qty: v })}
                          placeholder={t("scan.itemQty")}
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.lineItemSmall]}
                        />
                        <TextInput
                          testID={`line-item-price-${idx}`}
                          value={li.unit_price}
                          onChangeText={(v) => updateLineItem(idx, { unit_price: v })}
                          placeholder={t("scan.itemPrice")}
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.lineItemSmall]}
                        />
                        <TextInput
                          testID={`line-item-gst-${idx}`}
                          value={li.gst_rate}
                          onChangeText={(v) => updateLineItem(idx, { gst_rate: v })}
                          placeholder={t("scan.itemGst")}
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.lineItemSmall]}
                        />
                        <Pressable testID={`line-item-remove-${idx}`} onPress={() => removeLineItem(idx)} hitSlop={8} style={styles.lineItemDel}>
                          <Ionicons name="close-circle" size={20} color={colors.error} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </Animated.View>
              )}

              {/* DOCUMENT MODE */}
              {isDoc && docData && (
                <Animated.View entering={FadeInDown.duration(400).springify()}>
                  <Animated.View entering={FadeIn.delay(150)} style={styles.digitalHeader}>
                    <Ionicons name="sparkles" size={14} color={colors.brand} />
                    <Text style={styles.digitalHeaderText}>{t("scan.digitalCopy")}</Text>
                  </Animated.View>
                  <Field label={t("scan.docTitle")} value={docData.title} onChange={(v: string) => setDocData({ ...docData, title: v })} testID="field-doc-title" />
                  <Text style={styles.fieldLabel}>{t("scan.docType")}</Text>
                  <View style={styles.docTypeRow}>
                    {DOC_TYPES.map(([k, key]) => (
                      <Pressable
                        key={k}
                        testID={`doctype-${k}`}
                        onPress={() => setDocData({ ...docData, doc_type: k })}
                        style={[styles.docChip, docData.doc_type === k && styles.docChipOn]}
                      >
                        <Text style={[styles.docChipText, docData.doc_type === k && styles.docChipTextOn]}>{t(`scan.${key}`)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field label={t("scan.docDate")} value={docData.date} onChange={(v: string) => setDocData({ ...docData, date: v })} testID="field-doc-date" />
                    </View>
                    <View style={{ flex: 1.4 }}>
                      <Field label={t("scan.docParties")} value={docData.key_parties} onChange={(v: string) => setDocData({ ...docData, key_parties: v })} testID="field-doc-parties" />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>{t("scan.docExtracted")}</Text>
                  <TextInput
                    testID="field-doc-extracted"
                    value={docData.full_text}
                    onChangeText={(v: string) => setDocData({ ...docData, full_text: v })}
                    multiline
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
                  />
                  <Text style={styles.fieldLabel}>{t("scan.docClient")}</Text>
                  {clients.length === 0 ? (
                    <Text style={styles.emptyClients}>{t("scan.docNoClients")}</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
                      {clients.map((cl) => (
                        <Pressable
                          key={cl.id}
                          testID={`doc-client-${cl.id}`}
                          onPress={() => setPickedClientId(cl.id)}
                          style={[styles.chip, pickedClientId === cl.id && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, pickedClientId === cl.id && styles.chipTextActive]}>{cl.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </Animated.View>
              )}
            </ScrollView>

            {/* Save row */}
            {isDoc ? (
              <Pressable
                testID="save-doc-btn"
                style={[styles.primaryBtn, styles.fullBtn, (!pickedClientId || !docData?.title?.trim() || saving) && { opacity: 0.5 }]}
                onPress={saveDocument}
                disabled={!pickedClientId || !docData?.title?.trim() || saving}
              >
                {saving ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="folder" size={16} color={colors.onBrand} /><Text style={styles.primaryBtnText}>  {t("scan.docSave")}</Text></>)}
              </Pressable>
            ) : activeShiftId ? (
              <Pressable testID="add-to-shift-btn" style={[styles.primaryBtn, styles.fullBtn]} onPress={() => saveReceipt({ shift_id: activeShiftId }, t("scan.addedToShift"))} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="briefcase" size={16} color={colors.onBrand} /><Text style={styles.primaryBtnText}>  {t("scan.addToShift")}</Text></>)}
              </Pressable>
            ) : (
              <Pressable testID="save-receipt-btn" style={[styles.primaryBtn, styles.fullBtn]} onPress={() => saveReceipt({}, t("scan.filed"))} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryBtnText}>{t("scan.saveVault")}</Text>}
              </Pressable>
            )}
            <View style={styles.sheetActions}>
              {!isDoc && (
                <Pressable testID="archive-receipt-btn" style={styles.ghostBtn} onPress={() => saveReceipt({ archived: true }, t("scan.archived"))} disabled={saving}>
                  <Ionicons name="archive-outline" size={16} color={colors.onSurfaceTertiary} />
                  <Text style={styles.ghostText}>  {t("scan.archive")}</Text>
                </Pressable>
              )}
              <Pressable testID="delete-receipt-btn" style={[styles.ghostBtn, { borderColor: colors.error + "77" }]} onPress={discard} disabled={saving}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={[styles.ghostText, { color: colors.error }]}>  {t("scan.deleteBtn")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChange, keyboard, testID, placeholder }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface },
  permTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy },
  permText: { color: colors.muted, textAlign: "center" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: { alignItems: "center", paddingBottom: spacing.md, gap: spacing.sm },
  modeToggle: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 32, justifyContent: "center", borderRadius: radius.pill },
  modeChipOn: { backgroundColor: colors.brand },
  modeChipText: { color: "#fff", fontSize: 12, fontWeight: weight.bold, letterSpacing: 0.3 },
  modeChipTextOn: { color: colors.onBrand },
  scanTitle: { color: "#fff", fontSize: 18, fontWeight: weight.heavy },
  scanHint: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  frame: { alignSelf: "center", width: "78%", aspectRatio: 0.72, position: "relative", alignItems: "center", justifyContent: "center" },
  frameDoc: { aspectRatio: 0.78 },
  corner: { position: "absolute", width: 34, height: 34, borderColor: colors.brand },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanningHud: { alignItems: "center", gap: spacing.md, backgroundColor: "rgba(4,16,20,0.7)", padding: spacing.xl, borderRadius: radius.lg },
  scanningText: { color: colors.brand, fontWeight: weight.bold },
  bottomBar: { alignItems: "center", paddingTop: spacing.lg, gap: spacing.md },
  errorText: { color: colors.error, textAlign: "center", paddingHorizontal: spacing.xl },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "88%" },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy },
  confBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success + "22", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  confText: { color: colors.success, fontSize: 12, fontWeight: weight.bold },
  preview: { width: "100%", height: 120, borderRadius: radius.md, marginBottom: spacing.md },
  reviewNotice: { color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  itemsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addRowBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  addRowText: { color: colors.brand, fontSize: 13, fontWeight: weight.bold },
  lineItemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  lineItemDesc: { flex: 2, paddingVertical: spacing.sm },
  lineItemSmall: { flex: 1, paddingVertical: spacing.sm, minWidth: 0 },
  lineItemDel: { padding: 2 },
  chip: { paddingHorizontal: spacing.lg, height: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: weight.medium, fontSize: 13 },
  chipTextActive: { color: colors.onBrand, fontWeight: weight.bold },
  docTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  docChip: { paddingHorizontal: spacing.md, height: 32, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  docChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  docChipText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  docChipTextOn: { color: colors.onBrand },
  emptyClients: { color: colors.muted, fontSize: 12, paddingVertical: spacing.md, textAlign: "center" },
  sheetActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  ghostBtn: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  ghostText: { color: colors.onSurfaceTertiary, fontWeight: weight.bold, fontSize: 15 },
  primaryBtn: { flex: 1.4, height: 52, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  fullBtn: { flex: undefined, width: "100%", marginBottom: spacing.sm },
  digitalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, marginBottom: spacing.md },
  digitalHeaderText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  permBtn: { flex: 0, alignSelf: "center", width: 220, marginTop: spacing.md },
  primaryBtnText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
});
