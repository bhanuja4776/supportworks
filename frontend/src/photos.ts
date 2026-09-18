import * as ImagePicker from "expo-image-picker";

// Opens the camera; returns a base64 JPEG string or null.
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({
    base64: true,
    quality: 0.4,
    allowsEditing: false,
    mediaTypes: ["images"],
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return res.assets[0].base64;
}

// Opens the photo library; returns a base64 JPEG string or null.
export async function pickPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    base64: true,
    quality: 0.4,
    mediaTypes: ["images"],
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return res.assets[0].base64;
}
