import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage, LangCode } from "@/src/i18n";
import { colors, radius, spacing, weight } from "@/src/theme";

export function LanguagePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language as LangCode;

  const choose = async (code: LangCode) => {
    Haptics.selectionAsync();
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t("language.title")}</Text>
            <Pressable testID="lang-modal-close" onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {LANGUAGES.map((l) => {
              const active = l.code === current;
              return (
                <Pressable key={l.code} testID={`lang-modal-${l.code}`} style={[styles.row, active && styles.rowActive]} onPress={() => choose(l.code)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.native, active && { color: colors.brand }]}>{l.native}</Text>
                    <Text style={styles.label}>{l.label}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, paddingTop: spacing.sm, maxHeight: "80%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  native: { color: colors.onSurface, fontSize: 16, fontWeight: weight.bold },
  label: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
