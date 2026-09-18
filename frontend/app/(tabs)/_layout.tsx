import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { colors, weight } from "@/src/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        // Static object (not animated/absolute) and never hidden by the
        // keyboard — keeps the bar from visually "detaching" mid-scroll or
        // while a text field is focused. Individual screens (e.g. the
        // scanner) can still opt into hiding it themselves via
        // navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } }).
        tabBarHideOnKeyboard: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: weight.medium },
      }}
      screenListeners={{
        tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.command"),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t("tabs.clients"),
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("tabs.scan"),
          tabBarIcon: ({ color, size }) => <Ionicons name="scan-circle" size={size + 6} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: t("tabs.invoices"),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: t("tabs.planner"),
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />

      {/* Section & detail screens — kept inside tabs so the bottom nav stays visible everywhere */}
      <Tabs.Screen name="scan-text" options={{ href: null }} />
      <Tabs.Screen name="vault" options={{ href: null }} />
      <Tabs.Screen name="credentials" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="templates" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="ndis-codes" options={{ href: null }} />
      <Tabs.Screen name="notes" options={{ href: null }} />
      <Tabs.Screen name="shift" options={{ href: null }} />
      <Tabs.Screen name="client" options={{ href: null }} />
      <Tabs.Screen name="invoice" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="membership" options={{ href: null }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
      <Tabs.Screen name="language" options={{ href: null }} />
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="bank" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="consent" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="privacy-policy" options={{ href: null }} />
      <Tabs.Screen name="alert-sound" options={{ href: null }} />
    </Tabs>
  );
}
