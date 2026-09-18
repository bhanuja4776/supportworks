import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, View, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { CelebrationProvider } from "@/src/components/Celebration";
import { AuthProvider, useAuth } from "@/src/auth/AuthContext";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { UpgradeSheet } from "@/src/components/UpgradeSheet";
import { ensureAlarmChannels } from "@/src/alarms";
import { registerForPush } from "@/src/push";
import { colors } from "@/src/theme";
import { initLanguage } from "@/src/i18n";

// Foreground push display behaviour — module scope, native only.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Android notification channel — module scope.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [langReady, setLangReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    initLanguage().finally(() => setLangReady(true));
  }, []);

  useEffect(() => {
    if ((loaded || error) && langReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, langReady]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    registerForPush();
    ensureAlarmChannels();

    const routeFrom = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      url.startsWith("http") ? Linking.openURL(url) : router.push(url);
    };

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFrom(response.notification.request.content.data || {});
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) routeFrom(response.notification.request.content.data || {});
    });
    return () => { tapSub.remove(); };
  }, []);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if ((!loaded && !error) || !langReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <CelebrationProvider>
              <StatusBar style="light" />
              <View style={{ flex: 1, backgroundColor: colors.surface }}>
                <RootNav />
                <OfflineBanner />
                <UpgradeSheet />
              </View>
            </CelebrationProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootNav() {
  const { loading, user, needsOnboarding, needsConsent } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Cast: useSegments()'s generated tuple type is only as wide as the
    // shortest known route, which trips a false-positive "no element at
    // index 1" once enough top-level routes exist. Safe at runtime either
    // way — a JS array read past its length is just `undefined`.
    const segs = segments as readonly string[];
    const inAuth = segs[0] === "(auth)";
    const onOnboarding = segs[1] === "onboarding";
    const onConsent = segs[1] === "consent";
    if (!user && !inAuth) router.replace("/(auth)/login");
    else if (user && needsConsent && !onConsent) router.replace("/consent");
    else if (user && !needsConsent && needsOnboarding && !onOnboarding) router.replace("/onboarding");
    else if (user && inAuth && !needsOnboarding && !needsConsent) router.replace("/(tabs)");
  }, [user, loading, segments, needsOnboarding, needsConsent]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }} />;
}

// On web, the app fills the viewport on phone-sized screens (nothing
// changes there — 100% width all the way) and, on wider desktop screens,
// scales up to use the available space instead of sitting in a narrow
// column with large empty margins on either side. A generous upper cap
// (1400px) still applies on very wide/ultra-wide monitors so single-column
// mobile-style cards and forms don't stretch into unreadably long rows.
// No-op on native, where the screen is already this width or narrower.
const styles = StyleSheet.create({
  content:
    Platform.OS === "web"
      ? { backgroundColor: colors.surface, width: "100%", maxWidth: 1400, marginHorizontal: "auto" as any, height: "100%" }
      : { backgroundColor: colors.surface },
});
