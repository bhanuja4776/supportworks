import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { StyleSheet, Text, View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { colors, radius, spacing, weight } from "@/src/theme";

const { width } = Dimensions.get("window");

const SUCCESS_SOUND = require("../../assets/sounds/success.wav");
const CONFIRM_SOUND = require("../../assets/sounds/confirm.wav");

type CelebrateOpts = { sound?: boolean };
type CelebrateFn = (message?: string, opts?: CelebrateOpts) => void;
type FeedbackContext = { celebrate: CelebrateFn; confirm: (message?: string) => void };
const CelebrationContext = createContext<FeedbackContext>({ celebrate: () => {}, confirm: () => {} });
export const useCelebration = () => useContext(CelebrationContext).celebrate;
export const useConfirm = () => useContext(CelebrationContext).confirm;

const PARTICLES = Array.from({ length: 10 });

function Burst({ show }: { show: boolean }) {
  return (
    <View style={styles.burstWrap} pointerEvents="none">
      {PARTICLES.map((_, i) => (
        <Particle key={i} index={i} show={show} />
      ))}
    </View>
  );
}

function Particle({ index, show }: { index: number; show: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (show) {
      p.value = 0;
      p.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    }
  }, [show]);
  const angle = (index / PARTICLES.length) * Math.PI * 2;
  const dist = 120 + (index % 3) * 30;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      { translateY: Math.sin(angle) * dist * p.value },
      { scale: 0.6 + p.value * 0.8 },
    ],
  }));
  const colorPool = [colors.brand, colors.success, colors.info, colors.warning];
  return (
    <Animated.View
      style={[styles.particle, { backgroundColor: colorPool[index % colorPool.length] }, style]}
    />
  );
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState("Done!");
  const scale = useSharedValue(0);
  const glow = useSharedValue(0);
  const overlay = useSharedValue(0);

  const hide = useCallback(() => setVisible(false), []);
  const player = useAudioPlayer(SUCCESS_SOUND);
  const confirmPlayer = useAudioPlayer(CONFIRM_SOUND);

  const [toast, setToast] = useState("");
  const toastOpacity = useSharedValue(0);
  const hideToast = useCallback(() => setToast(""), []);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const confirm = useCallback((message?: string) => {
    setToast(message || "Saved");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { confirmPlayer.seekTo(0); confirmPlayer.play(); } catch {}
    toastOpacity.value = withTiming(1, { duration: 160 });
    toastOpacity.value = withDelay(1500, withTiming(0, { duration: 300 }, (fin) => {
      if (fin) runOnJS(hideToast)();
    }));
  }, [confirmPlayer]);

  const celebrate = useCallback((message?: string, opts?: CelebrateOpts) => {
    setMsg(message || "Nice work!");
    setVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (opts?.sound) {
      try {
        player.seekTo(0);
        player.play();
      } catch {}
    }
    overlay.value = withTiming(1, { duration: 180 });
    glow.value = withSequence(withTiming(1, { duration: 300 }), withTiming(0.4, { duration: 500 }));
    scale.value = 0;
    scale.value = withSpring(1, { damping: 9, stiffness: 140 });
    overlay.value = withDelay(
      1400,
      withTiming(0, { duration: 300 }, (fin) => {
        if (fin) runOnJS(hide)();
      })
    );
  }, [player]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.5 }],
  }));
  const toastStyle = useAnimatedStyle(() => ({ opacity: toastOpacity.value }));

  return (
    <CelebrationContext.Provider value={{ celebrate, confirm }}>
      {children}
      {!!toast && (
        <Animated.View style={[styles.toast, toastStyle]} pointerEvents="none" testID="confirm-toast">
          <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
      {visible && (
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" testID="celebration-overlay">
          <Burst show={visible} />
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Ionicons name="checkmark-sharp" size={54} color={colors.onBrand} />
          </Animated.View>
          <Text style={styles.msg}>{msg}</Text>
        </Animated.View>
      )}
    </CelebrationContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,16,20,0.72)",
    zIndex: 9999,
  },
  burstWrap: { position: "absolute", alignItems: "center", justifyContent: "center", width, height: 1 },
  particle: { position: "absolute", width: 12, height: 12, borderRadius: 6 },
  glow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.brand,
  },
  badge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand,
    shadowOpacity: 0.9,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  msg: {
    marginTop: spacing.xl,
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: weight.heavy,
    letterSpacing: 0.3,
  },
  toast: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.brand,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
});
