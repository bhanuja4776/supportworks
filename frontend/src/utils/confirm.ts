import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirm dialog. Alert.alert is a no-op on react-native-web,
 * so we fall back to window.confirm there.
 */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const { title, message = "", confirmText = "Confirm", cancelText = "Cancel", destructive, onConfirm } = opts;
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message || undefined, [
    { text: cancelText, style: "cancel" },
    { text: confirmText, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}
