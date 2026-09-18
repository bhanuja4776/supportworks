import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import i18n from "@/src/i18n";

export const ALERT_SOUNDS: { id: string; labelKey: string; file: string | null }[] = [
  { id: "default", labelKey: "alertSound.default", file: null },
  { id: "chime", labelKey: "alertSound.chime", file: "chime.wav" },
  { id: "bell", labelKey: "alertSound.bell", file: "bell.wav" },
  { id: "pulse", labelKey: "alertSound.pulse", file: "pulse.wav" },
];

const SOUND_KEY = "alert_sound_v1";
const MAP_KEY = "task_alarm_map_v1";
let askedThisSession = false;

export async function getAlertSound(): Promise<string> {
  try { return (await AsyncStorage.getItem(SOUND_KEY)) || "default"; } catch { return "default"; }
}

export async function setAlertSound(id: string) {
  try { await AsyncStorage.setItem(SOUND_KEY, id); } catch {}
}

// Android channels are immutable once created — one channel per selectable sound.
export async function ensureAlarmChannels() {
  if (Platform.OS !== "android") return;
  for (const s of ALERT_SOUNDS) {
    try {
      await Notifications.setNotificationChannelAsync(`alarm-${s.id}`, {
        name: `Planner alarms (${s.id})`,
        importance: Notifications.AndroidImportance.MAX,
        sound: s.file || "default",
        vibrationPattern: [0, 300, 250, 300],
      });
    } catch {}
  }
}

// Contextual permission flow — ask only when the user schedules a timed plan.
export async function ensureAlarmPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (askedThisSession) return false;
    askedThisSession = true;
    if (!cur.canAskAgain) {
      Alert.alert(
        i18n.t("planner.alarmPermOffTitle"),
        i18n.t("planner.alarmPermOffMsg"),
        [
          { text: i18n.t("upgrade.notNow"), style: "cancel" },
          { text: i18n.t("planner.openSettings"), onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }
    return await new Promise((resolve) => {
      Alert.alert(
        i18n.t("planner.alarmPermTitle"),
        i18n.t("planner.alarmPermMsg"),
        [
          { text: i18n.t("upgrade.notNow"), style: "cancel", onPress: () => resolve(false) },
          {
            text: i18n.t("planner.allow"),
            onPress: async () => {
              try { const r = await Notifications.requestPermissionsAsync(); resolve(!!r.granted); } catch { resolve(false); }
            },
          },
        ],
      );
    });
  } catch { return false; }
}

async function loadMap(): Promise<Record<string, string>> {
  try { const v = await AsyncStorage.getItem(MAP_KEY); return v ? JSON.parse(v) : {}; } catch { return {}; }
}
async function saveMap(m: Record<string, string>) {
  try { await AsyncStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch {}
}

export async function cancelTaskAlarm(taskId: string) {
  if (Platform.OS === "web") return;
  const map = await loadMap();
  const nid = map[taskId];
  if (nid) {
    try { await Notifications.cancelScheduledNotificationAsync(nid); } catch {}
    delete map[taskId];
    await saveMap(map);
  }
}

export async function scheduleTaskAlarm(task: { id: string; title: string; date: string; time: string }, body: string) {
  if (Platform.OS === "web" || !task.time || !task.date) return;
  const m = task.time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return;
  const when = new Date(`${task.date.slice(0, 10)}T${m[1].padStart(2, "0")}:${m[2]}:00`);
  if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return;
  await cancelTaskAlarm(task.id);
  const soundId = await getAlertSound();
  const s = ALERT_SOUNDS.find((x) => x.id === soundId);
  try {
    const nid = await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body,
        sound: (s?.file || "default") as any,
        data: { deeplink: "/planner" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: Platform.OS === "android" ? `alarm-${soundId}` : undefined,
      } as any,
    });
    const map = await loadMap();
    map[task.id] = nid;
    await saveMap(map);
  } catch {}
}
