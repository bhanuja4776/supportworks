import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Alert, Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@/src/auth/AuthContext";
import { useTranslation } from "react-i18next";
import { confirmAction } from "@/src/utils/confirm";
import { pickPhoto, capturePhoto } from "@/src/photos";
import { colors, radius, spacing, weight } from "@/src/theme";

const initials = (n = "") => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export default function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const openEdit = () => {
    setEditName(user?.name || "");
    setEditPhoto(user?.picture || "");
    setEditModal(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) { Alert.alert("Name required", "Please enter your name."); return; }
    setSavingProfile(true);
    try {
      await updateProfile({ name: editName.trim(), picture: editPhoto });
      setEditModal(false);
      Alert.alert("Profile updated", "Your details have been saved.");
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    } finally { setSavingProfile(false); }
  };

  const confirmLogout = () => {
    confirmAction({ title: "Log out", message: "You'll need to sign in again.", confirmText: "Log out", destructive: true, onConfirm: logout });
  };

  return (
    <View style={styles.container} testID="account-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("account.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Pressable testID="edit-profile-btn" style={styles.profile} onPress={openEdit}>
          <View style={styles.avatar}>
            {user?.picture ? (
              <Image source={{ uri: user.picture.startsWith("http") ? user.picture : `data:image/jpeg;base64,${user.picture}` }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials(user?.name || user?.email)}</Text>
            )}
            <View style={styles.editBadge}><Ionicons name="pencil" size={12} color={colors.onBrand} /></View>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.editHint}>{t("account.tapToEdit")}</Text>
        </Pressable>

        <Pressable testID="account-membership" style={styles.row} onPress={() => router.push("/membership")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.brand + "22" }]}><Ionicons name="diamond" size={18} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.membership")}</Text>
            <Text style={styles.rowSub}>{t("account.membershipSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable testID="account-language" style={styles.row} onPress={() => router.push("/language")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.brand + "22" }]}><Ionicons name="language" size={18} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.language")}</Text>
            <Text style={styles.rowSub}>{t("account.languageSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable testID="account-alert-sound" style={styles.row} onPress={() => router.push("/alert-sound")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.warning + "22" }]}><Ionicons name="notifications" size={18} color={colors.warning} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.alertSound")}</Text>
            <Text style={styles.rowSub}>{t("account.alertSoundSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable testID="account-learn" style={styles.row} onPress={() => router.push("/learn")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.success + "22" }]}><Ionicons name="school" size={18} color={colors.success} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.learnTitle")}</Text>
            <Text style={styles.rowSub}>{t("account.learnSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable testID="account-tour" style={styles.row} onPress={() => router.push("/onboarding?tour=1")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.warning + "22" }]}><Ionicons name="rocket" size={18} color={colors.warning} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("onboarding.howToTitle")}</Text>
            <Text style={styles.rowSub}>{t("onboarding.howToSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Pressable testID="account-privacy-policy" style={styles.row} onPress={() => router.push("/privacy-policy")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.success + "22" }]}><Ionicons name="lock-closed" size={18} color={colors.success} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.privacyPolicy")}</Text>
            <Text style={styles.rowSub}>{t("account.privacyPolicySub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View testID="account-retention" style={styles.retentionBox}>
          <Ionicons name="shield-checkmark" size={16} color={colors.brand} />
          <Text style={styles.retentionText}>{t("account.retentionNote")}</Text>
        </View>

        <Pressable testID="account-logout" style={[styles.row, { marginTop: spacing.xl }]} onPress={confirmLogout}>
          <View style={[styles.rowIcon, { backgroundColor: colors.error + "22" }]}><Ionicons name="log-out" size={18} color={colors.error} /></View>
          <Text style={[styles.rowTitle, { color: colors.error }]}>{t("account.logout")}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t("account.editProfile")}</Text>
            <View style={styles.editAvatarRow}>
              <View style={styles.avatarSm}>
                {editPhoto ? (
                  <Image source={{ uri: editPhoto.startsWith("http") ? editPhoto : `data:image/jpeg;base64,${editPhoto}` }} style={styles.avatarSmImg} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarSmText}>{initials(editName || user?.email)}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable testID="profile-photo-camera" style={styles.photoBtn} onPress={async () => { const p = await capturePhoto(); if (p) setEditPhoto(p); }}>
                    <Ionicons name="camera" size={16} color={colors.brand} />
                    <Text style={styles.photoBtnText}>Snap</Text>
                  </Pressable>
                  <Pressable testID="profile-photo-upload" style={styles.photoBtn} onPress={async () => { const p = await pickPhoto(); if (p) setEditPhoto(p); }}>
                    <Ionicons name="image" size={16} color={colors.brand} />
                    <Text style={styles.photoBtnText}>Upload</Text>
                  </Pressable>
                  {!!editPhoto && (
                    <Pressable testID="profile-photo-remove" style={styles.photoBtn} onPress={() => setEditPhoto("")}>
                      <Ionicons name="close" size={16} color={colors.error} />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.hint}>Add a profile photo (optional).</Text>
              </View>
            </View>
            <Text style={styles.fieldLabel}>{t("account.nameLabel")}</Text>
            <TextInput testID="profile-name-input" value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.fieldLabel}>{t("auth.email")}</Text>
            <View style={[styles.input, styles.inputDisabled]}><Text style={styles.disabledText}>{user?.email}</Text></View>
            <Pressable testID="profile-save-btn" style={[styles.saveBtn, savingProfile && { opacity: 0.6 }]} onPress={saveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.saveText}>{t("account.saveChanges")}</Text>}
            </Pressable>
            <Pressable onPress={() => setEditModal(false)} style={{ padding: spacing.md, alignItems: "center" }}>
              <Text style={styles.cancel}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: weight.heavy },
  profile: { alignItems: "center", gap: spacing.xs, marginVertical: spacing.lg },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand + "22", borderWidth: 2, borderColor: colors.brand, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { color: colors.brand, fontSize: 26, fontWeight: weight.heavy },
  editBadge: { position: "absolute", right: 2, bottom: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  editHint: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, marginTop: spacing.xs },
  name: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginTop: spacing.sm },
  email: { color: colors.muted, fontSize: 14 },
  section: { color: colors.brand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  retentionBox: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.brand + "33" },
  retentionText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  onPill: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  onPillText: { color: colors.onBrand, fontSize: 11, fontWeight: weight.heavy, letterSpacing: 1 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  pinCard: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  pinTitle: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy, marginBottom: spacing.lg },
  dots: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.borderStrong },
  dotOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pad: { width: 240, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  key: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  keyText: { color: colors.onSurface, fontSize: 24, fontWeight: weight.bold },
  saveBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", alignSelf: "stretch", marginTop: spacing.xl },
  saveText: { color: colors.onBrand, fontWeight: weight.heavy, fontSize: 15 },
  cancel: { color: colors.muted, fontWeight: weight.bold },
  sheetWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  editAvatarRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  avatarSm: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand + "22", borderWidth: 2, borderColor: colors.brand, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarSmImg: { width: "100%", height: "100%" },
  avatarSmText: { color: colors.brand, fontSize: 22, fontWeight: weight.heavy },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  photoBtnText: { color: colors.brand, fontWeight: weight.bold, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 11 },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  inputDisabled: { justifyContent: "center", opacity: 0.7 },
  disabledText: { color: colors.muted, fontSize: 15 },
});
