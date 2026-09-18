import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, weight } from "@/src/theme";

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

type Props = {
  name?: string;
  color?: string;
  icon?: string;
  photo?: string;
  size?: number;
};

export function ClientAvatar({ name = "", color, icon, photo, size = 48 }: Props) {
  const tint = color || colors.brand;
  const radius = size / 2;
  if (photo) {
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${photo}` }}
        style={{ width: size, height: size, borderRadius: radius, borderWidth: 1.5, borderColor: tint }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius, backgroundColor: tint + "22", borderColor: tint },
      ]}
    >
      {icon && icon !== "person" ? (
        <Ionicons name={icon as any} size={size * 0.5} color={tint} />
      ) : (
        <Text style={{ color: tint, fontSize: size * 0.36, fontWeight: weight.heavy }}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
});
