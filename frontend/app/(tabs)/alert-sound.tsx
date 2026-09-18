import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAudioPlayer } from "expo-audio";
import { ALERT_SOUNDS, getAlertSound, setAlertSound } from "@/src/alarms";
import { colors, radius, spacing, weight } from "@/src/theme";

const SOURCES: Record<string, any> = {
  chime: require("../../assets/sounds/chime.wav"),
  bell: require("../../assets/sounds/bell.wav"),
  pulse: require("../../assets/sounds/pulse.wav"),
};

// Pick the sound used for planner alarms; tap a row to save + preview it.
export default function AlertSound() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [current, setCurrent] = useState("default");
  const player = useAudioPlayer(null);

  useEffect(() => { getAlertSound().then(setCurrent); }, []);

  const choose = async (id: string) => {
    setCurrent(id);
    await setAlertSound(id);
    if (SOURCES[id]) {
      try {
        player.replace(SOURCES[id]);
        player.seekTo(0);
        player.play();
      } catch {}
    }
  };

  return (
    <View style={styles.container} testID="alert-sound-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("alertSound.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={styles.subtitle}>{t("alertSound.subtitle")}</Text>
        {ALERT_SOUNDS.map((s) => {
          const on = current === s.id;
          return (
            <Pressable key={s.id} testID={`sound-${s.id}`} style={[styles.row, on && { borderColor: colors.brand }]} onPress={() => choose(s.id)}>
              <View style={[styles.rowIcon, { backgroundColor: (on ? colors.brand : colors.muted) + "22" }]}>
                <Ionicons name={s.id === "default" ? "notifications" : "musical-notes"} size={18} color={on ? colors.brand : colors.muted} />
              </View>
              <Text style={[styles.rowTitle, on && { color: colors.brand }]}>{t(s.labelKey)}</Text>
              {s.file && <Ionicons name="play-circle-outline" size={20} color={colors.muted} style={{ marginRight: spacing.sm }} />}
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.brand : colors.borderStrong} />
            </Pressable>
          );
        })}
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          <Text style={styles.noteText}>{t("alertSound.buildNote")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold, flex: 1 },
  note: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  noteText: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 },
});
