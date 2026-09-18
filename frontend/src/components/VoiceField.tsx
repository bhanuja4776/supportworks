import { useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useVoice } from "@/src/useVoice";
import { colors, radius, spacing, weight } from "@/src/theme";

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  testID?: string;
};

export function VoiceField({ label, value, onChangeText, placeholder, multiline, testID }: Props) {
  const { recording, transcribing, start, stop } = useVoice();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (recording) {
      pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [recording]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: recording ? colors.brand : colors.border,
    shadowOpacity: pulse.value * 0.8,
  }));

  const onMic = async () => {
    if (recording) {
      const text = await stop();
      if (text) onChangeText(value ? `${value} ${text}` : text);
    } else {
      await start();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.field, multiline && styles.multiline, borderStyle]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={recording ? "Listening…" : placeholder}
          placeholderTextColor={colors.muted}
          style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }]}
          multiline={multiline}
        />
        <Pressable
          testID={testID ? `${testID}-mic` : "voice-mic"}
          onPress={onMic}
          style={[styles.mic, recording && styles.micActive]}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Ionicons
              name={recording ? "stop" : "mic"}
              size={18}
              color={recording ? colors.onBrand : colors.brand}
            />
          )}
        </Pressable>
      </Animated.View>
      {recording && <Text style={styles.hint}>Speak now — tap stop when finished</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    shadowColor: colors.brand,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  multiline: { alignItems: "flex-start", paddingVertical: spacing.sm },
  input: { flex: 1, color: colors.onSurface, fontSize: 15, paddingVertical: spacing.md },
  mic: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandTertiary, marginLeft: spacing.sm,
  },
  micActive: { backgroundColor: colors.brand },
  hint: { color: colors.brand, fontSize: 12, marginTop: spacing.xs, fontWeight: weight.medium },
});
