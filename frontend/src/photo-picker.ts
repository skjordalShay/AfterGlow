import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; fileName: string; mimeType: string };

function confirm(title: string, body: string, okLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: okLabel, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Contextual permission flow: explain → ask (at most once more if allowed) →
 * point to Settings when blocked. Returns null when the user backs out.
 */
async function ensurePhotoAccess(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    Alert.alert(
      "Photo access is turned off",
      "To add a profile photo, allow photo access for The Afterglow in your phone's Settings.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }
  const ok = await confirm(
    "Add a warm profile photo",
    "We'll open your photos so you can choose one. A friendly face helps other members feel at ease.",
    "Continue",
  );
  if (!ok) return false;
  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (asked.granted) return true;
  if (!asked.canAskAgain) {
    Alert.alert(
      "Photo access is turned off",
      "You can allow photo access any time from Settings.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
  }
  return false;
}

export async function pickProfilePhoto(): Promise<PickedPhoto | null> {
  const allowed = await ensurePhotoAccess();
  if (!allowed) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  const mimeType = a.mimeType || "image/jpeg";
  const ext = mimeType.split("/")[1] || "jpg";
  return {
    uri: a.uri,
    fileName: a.fileName || `profile.${ext}`,
    mimeType,
  };
}
