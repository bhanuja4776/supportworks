import { Text, View, StyleSheet } from "react-native";
import { colors, spacing, weight } from "@/src/theme";

// Minimal renderer for the policy's markdown-ish text (#, ##, - bullets, paragraphs).
export function PolicyContent({ content }: { content: string }) {
  const lines = (content || "").split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        const s = line.trim();
        if (!s) return <View key={i} style={{ height: spacing.sm }} />;
        if (s.startsWith("# ")) return <Text key={i} style={styles.h1}>{s.slice(2)}</Text>;
        if (s.startsWith("## ")) return <Text key={i} style={styles.h2}>{s.slice(3)}</Text>;
        if (s.startsWith("- ")) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.body, { flex: 1 }]}>{s.slice(2)}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.body}>{s}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.sm },
  h2: { color: colors.brand, fontSize: 15, fontWeight: weight.heavy, marginTop: spacing.md, marginBottom: spacing.xs },
  body: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 21 },
  bulletRow: { flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.xs, marginBottom: 2 },
  bullet: { color: colors.brand, fontSize: 14, lineHeight: 21 },
});
