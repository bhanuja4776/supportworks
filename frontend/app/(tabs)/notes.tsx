import { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { colors, radius, spacing, weight } from "@/src/theme";
import { useVoice } from "@/src/useVoice";
import { capturePhoto, pickPhoto } from "@/src/photos";
import { useConfirm } from "@/src/components/Celebration";
import { RichNoteEditor, RichNoteHandle, PlainNoteFallback } from "@/src/components/RichNoteEditor";

const TEXT_COLORS = ["#F0F9FF", "#00E5FF", "#34D399", "#FBBF24", "#F87171", "#A78BFA"];
const BG_COLORS = ["#0A1E24", "#041014", "#001D23", "#1E293B", "#2A1A3A", "#0F2A1E"];

const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
// Photos are Storage URLs once saved; a freshly-captured photo is raw
// base64 until the next save uploads it — render either correctly.
const photoUri = (p: string) => (p.startsWith("http://") || p.startsWith("https://") ? p : `data:image/jpeg;base64,${p}`);

export default function NotesEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date || new Date().toISOString().slice(0, 10);
  const { recording, transcribing, start, stop } = useVoice();
  const isWeb = Platform.OS === "web";
  const editorRef = useRef<RichNoteHandle>(null);

  const [note, setNote] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [fontLevel, setFontLevel] = useState(3);
  const htmlRef = useRef<string>("");

  const load = useCallback(async () => {
    try {
      const n = await api.getNote(date);
      setNote(n);
      htmlRef.current = n?.text || "";
    } catch {}
  }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patch = (p: any) => setNote((n: any) => ({ ...n, ...p }));

  const save = async () => {
    setSaving(true);
    try {
      const text = isWeb ? note.text : htmlRef.current;
      await api.putNote(date, {
        text, font: note.font, font_size: note.font_size,
        text_color: note.text_color, bg_color: note.bg_color, photos: note.photos || [],
      });
      confirm("Notes saved");
      router.back();    } catch (e: any) {
      Alert.alert("Couldn't save notes", e?.message || "Please try again.");
      setSaving(false);
    }
  };

  const onMic = async () => {
    if (recording) {
      const t = await stop();
      if (t) {
        if (isWeb) patch({ text: note.text ? `${note.text} ${t}` : t });
        else editorRef.current?.insertText(note.text ? ` ${t}` : t);
      }
    } else { await start(); }
  };

  const addPhoto = async (fromCamera: boolean) => {
    const p = fromCamera ? await capturePhoto() : await pickPhoto();
    if (!p) return;
    if (isWeb) {
      patch({ photos: [...(note.photos || []), p] });
    } else {
      editorRef.current?.insertImage(`data:image/jpeg;base64,${p}`);
    }
  };

  const pickTextColor = (c: string) => {
    patch({ text_color: c });
    if (!isWeb) editorRef.current?.setForeColor(c);
  };

  const changeFont = (delta: number) => {
    const next = Math.min(7, Math.max(1, fontLevel + delta));
    setFontLevel(next);
    if (!isWeb) editorRef.current?.setFontSize(next);
    else patch({ font_size: Math.min(34, Math.max(12, (note.font_size || 18) + delta * 2)) });
  };

  if (!note) {
    return <View style={[styles.container, { justifyContent: "center" }]}><ActivityIndicator color={colors.brand} /></View>;
  }

  const readable = new Date(date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <View style={[styles.container, { backgroundColor: note.bg_color }]} testID="notes-editor-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-down" size={26} color={note.text_color} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: note.text_color }]}>{readable}</Text>
        <Pressable testID="save-notes-btn" onPress={save} style={styles.iconBtn} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="checkmark" size={26} color={colors.brand} />}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {isWeb ? (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PlainNoteFallback
              testID="notes-input"
              value={stripHtml(note.text)}
              onChangeText={(t) => patch({ text: t })}
              textColor={note.text_color}
              fontSize={note.font_size || 18}
              placeholder="Start documenting today's activities…"
            />
            {(note.photos || []).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                {note.photos.map((p: string, idx: number) => (
                  <View key={idx} style={styles.photoWrap}>
                    <Image source={{ uri: photoUri(p) }} style={styles.photo} contentFit="cover" />
                    <Pressable testID={`del-photo-${idx}`} onPress={() => patch({ photos: note.photos.filter((_: any, i: number) => i !== idx) })} style={styles.photoDel}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
            <RichNoteEditor
              key={note.bg_color}
              ref={editorRef}
              initialHTML={htmlRef.current}
              textColor={note.text_color}
              bgColor={note.bg_color}
              placeholder="Start documenting today's activities…"
              onChange={(html) => { htmlRef.current = html; }}
            />
          </View>
        )}

        {/* Toolbar */}
        <View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, alignItems: "center", paddingHorizontal: spacing.lg }}>
            <Pressable testID="mic-btn" onPress={onMic} style={[styles.toolBtn, recording && { backgroundColor: colors.brand }]}>
              {transcribing ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name={recording ? "stop" : "mic"} size={20} color={recording ? colors.onBrand : colors.brand} />}
            </Pressable>
            <Pressable testID="add-photo-camera" onPress={() => addPhoto(true)} style={styles.toolBtn}><Ionicons name="camera" size={20} color={colors.brand} /></Pressable>
            <Pressable testID="add-photo-lib" onPress={() => addPhoto(false)} style={styles.toolBtn}><Ionicons name="image" size={20} color={colors.brand} /></Pressable>

            {!isWeb && (
              <>
                <View style={styles.sep} />
                <Pressable testID="fmt-bold" onPress={() => editorRef.current?.setBold()} style={styles.toolBtn}><Text style={styles.toolTxtBig}>B</Text></Pressable>
                <Pressable testID="fmt-italic" onPress={() => editorRef.current?.setItalic()} style={styles.toolBtn}><Text style={[styles.toolTxtBig, { fontStyle: "italic" }]}>i</Text></Pressable>
              </>
            )}

            <View style={styles.sep} />
            <Pressable testID="font-dec" onPress={() => changeFont(-1)} style={styles.toolBtn}><Text style={styles.toolTxtSmall}>A-</Text></Pressable>
            <Pressable testID="font-inc" onPress={() => changeFont(1)} style={styles.toolBtn}><Text style={styles.toolTxtBig}>A+</Text></Pressable>

            <View style={styles.sep} />
            <Ionicons name="text" size={16} color={colors.muted} />
            {TEXT_COLORS.map((c) => (
              <Pressable key={c} testID={`textcolor-${c}`} onPress={() => pickTextColor(c)} style={[styles.swatch, { backgroundColor: c }, note.text_color === c && styles.swatchActive]} />
            ))}
            <View style={styles.sep} />
            <Ionicons name="color-fill" size={16} color={colors.muted} />
            {BG_COLORS.map((c) => (
              <Pressable key={c} testID={`bgcolor-${c}`} onPress={() => patch({ bg_color: c })} style={[styles.swatch, { backgroundColor: c, borderColor: colors.borderStrong }, note.bg_color === c && styles.swatchActive]} />
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: weight.heavy },
  photoWrap: { position: "relative" },
  photo: { width: 96, height: 96, borderRadius: radius.md },
  photoDel: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  toolbar: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingTop: spacing.md },
  toolBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  toolTxtSmall: { color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  toolTxtBig: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold },
  sep: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: colors.onSurface },
});
