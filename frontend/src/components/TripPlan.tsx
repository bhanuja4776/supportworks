import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing, weight } from "@/src/theme";

export type TripStop = { name?: string; address?: string; icon?: string };

const dest = (s: TripStop) => encodeURIComponent(s.address || s.name || "");
const openGoogle = (s: TripStop) =>
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest(s)}`);
const openWaze = (s: TripStop) =>
  Linking.openURL(`https://waze.com/ul?q=${dest(s)}&navigate=yes`);

/** Ordered trip stops with one-tap navigation into Google Maps or Waze. */
export function TripPlan({ stops }: { stops: TripStop[] }) {
  const { t } = useTranslation();
  if (!stops?.length) return null;
  return (
    <View style={styles.wrap}>
      {stops.map((s, i) => (
        <View key={i} style={styles.row} testID={`trip-stop-${i}`}>
          <View style={styles.orderBadge}><Text style={styles.orderText}>{i + 1}</Text></View>
          <View style={styles.iconWrap}><Ionicons name={(s.icon || "location") as any} size={15} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{s.name || s.address}</Text>
            {!!s.address && !!s.name && <Text style={styles.addr} numberOfLines={1}>{s.address}</Text>}
          </View>
          <Pressable testID={`trip-maps-${i}`} style={styles.mapBtn} onPress={() => openGoogle(s)}>
            <Ionicons name="navigate" size={12} color={colors.onBrand} />
            <Text style={styles.mapText}>{t("shift.openMaps")}</Text>
          </Pressable>
          <Pressable testID={`trip-waze-${i}`} style={[styles.mapBtn, styles.wazeBtn]} onPress={() => openWaze(s)}>
            <Text style={styles.wazeText}>{t("shift.openWaze")}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  orderBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  orderText: { color: colors.onBrand, fontSize: 11, fontWeight: weight.heavy },
  iconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  addr: { color: colors.muted, fontSize: 11, marginTop: 1 },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  mapText: { color: colors.onBrand, fontSize: 11, fontWeight: weight.heavy },
  wazeBtn: { backgroundColor: "#33CCFF22", borderWidth: 1, borderColor: "#33CCFF" },
  wazeText: { color: "#33CCFF", fontSize: 11, fontWeight: weight.heavy },
});
