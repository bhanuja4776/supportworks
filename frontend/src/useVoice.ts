import { useState, useCallback } from "react";
import { Alert, Linking } from "react-native";
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api";

export function useVoice() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      setError(null);
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone permission denied");
        if (perm.canAskAgain === false) {
          Alert.alert(
            "Microphone blocked",
            "Enable microphone access in Settings to dictate notes hands-free.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert("Microphone needed", "Please allow microphone access so we can transcribe your voice.");
        }
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return true;
    } catch (e: any) {
      setError(e?.message || "Could not start recording");
      Alert.alert("Recording error", e?.message || "Could not start recording. Please try again.");
      return false;
    }
  }, [recorder]);

  // Stops recording, transcribes, returns the text (or null).
  const stop = useCallback(async (): Promise<string | null> => {
    try {
      setRecording(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        Alert.alert("Nothing recorded", "We couldn't capture any audio. Please try again.");
        return null;
      }
      setTranscribing(true);
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!b64) {
        Alert.alert("Nothing recorded", "The recording was empty. Please try again.");
        return null;
      }
      const res = await api.transcribe(b64, "m4a");
      const text = res?.text ?? null;
      if (!text) {
        Alert.alert("No speech detected", "We couldn't hear any words. Please try speaking again.");
      }
      return text;
    } catch (e: any) {
      setError(e?.message || "Transcription failed");
      Alert.alert("Transcription failed", "We couldn't transcribe that. Check your connection and try again.");
      return null;
    } finally {
      setTranscribing(false);
    }
  }, [recorder]);

  return { recording, transcribing, error, start, stop };
}
