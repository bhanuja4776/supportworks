import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, weight } from "@/src/theme";
import { TIPS, TIP_STYLE } from "@/src/tips";

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function TipsBanner() {
  const order = useMemo(() => shuffle(TIPS), []);
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const idxRef = useRef(0);

  const advance = () => {
    Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
      idxRef.current = (idxRef.current + 1) % order.length;
      setIdx(idxRef.current);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    const timer = setInterval(advance, 14000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length]);

  const tip = order[idx];
  const style = TIP_STYLE[tip.c];

  return (
    <Pressable onPress={advance} testID="tips-banner" style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={style.icon as any} size={18} color={colors.brand} />
      </View>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Text style={styles.label}>{style.label}</Text>
        <Text style={styles.text}>{tip.t}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    minHeight: 92,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  text: { color: colors.onSurface, fontSize: 13.5, lineHeight: 19, fontWeight: weight.medium },
});
