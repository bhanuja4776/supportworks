import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import NetInfo from "@react-native-community/netinfo";
import { colors, radius, spacing, weight } from "@/src/theme";

// Simplified for the Firestore-backed app: every read/write now goes
// through the Firestore SDK, which has its own built-in offline cache and
// write queue (syncs automatically on reconnect, no app code involved) —
// the old hand-rolled AsyncStorage cache/mutation-queue this banner used to
// drive is gone. All that's left worth telling the user is "your device
// currently has no network connection", read straight from NetInfo instead
// of a dead-backend health probe (which is what falsely kept this banner
// showing "offline" even when the user — and Firestore — were online).
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return unsub;
  }, []);

  if (online) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]} testID="offline-banner">
      <View style={[styles.pill, { backgroundColor: colors.warning }]}>
        <Ionicons name="cloud-offline" size={14} color={colors.onBrand} />
        <Text style={styles.text} numberOfLines={1}>{t("offline.offline")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 9999 },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, maxWidth: "92%" },
  text: { color: colors.onBrand, fontSize: 12, fontWeight: weight.bold },
});
