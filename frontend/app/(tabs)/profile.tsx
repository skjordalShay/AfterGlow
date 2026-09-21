import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, getStoredUser, signOut, User, fetchMe } from "@/src/auth";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState("");
  const [zip, setZip] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = (await fetchMe()) ?? (await getStoredUser());
      if (u) {
        setUser(u);
        setFirstName(u.first_name || "");
        setZip(u.zip_code || "");
        setAbout(u.about || "");
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<User>("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: firstName.trim(),
          zip_code: zip.trim() || null,
          about: about.trim() || null,
        }),
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await signOut();
    router.replace("/welcome");
  }

  if (!user) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        testID="profile-screen"
      >
        <View style={styles.banner}>
          <LinearGradient
            colors={[colors.brand, colors.surfaceInverse, "#7A3B3B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.bannerContent, { paddingTop: insets.top + spacing.lg }]}>
            <Text style={styles.eyebrow}>MY PROFILE</Text>
            <Text style={styles.name}>{user.first_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.field}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              testID="profile-firstname-input"
              value={firstName}
              onChangeText={setFirstName}
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Zip code / Location</Text>
            <TextInput
              testID="profile-zip-input"
              value={zip}
              onChangeText={setZip}
              style={styles.input}
              placeholder="e.g. 10001"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>About my journey</Text>
            <TextInput
              testID="profile-about-input"
              value={about}
              onChangeText={setAbout}
              multiline
              numberOfLines={5}
              placeholder="A gentle note about who you are and what you're looking for."
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {saved && <Text style={styles.saved}>Saved ✓</Text>}

          <Pressable
            testID="profile-save-button"
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || saving) && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? "Saving..." : "Save profile"}
            </Text>
          </Pressable>

          <Pressable
            testID="profile-premium-button"
            onPress={() => router.push("/premium")}
            style={({ pressed }) => [styles.premiumBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.premiumBtnText}>
              ✨  Unlock Premium
            </Text>
            <Text style={styles.premiumBtnSub}>
              Unlimited waves, see who viewed you, and more.
            </Text>
          </Pressable>

          <Pressable
            testID="profile-signout-button"
            onPress={onSignOut}
            style={styles.signOutBtn}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  banner: { overflow: "hidden" },
  bannerContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    color: colors.brandSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 12,
    letterSpacing: 3,
  },
  name: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.displayBold,
    fontSize: 40,
    marginTop: spacing.xs,
  },
  email: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 15,
    opacity: 0.8,
    marginTop: 4,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  field: { gap: spacing.xs },
  label: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 15,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 56,
    color: colors.onSurface,
    fontFamily: fonts.text,
    fontSize: 18,
  },
  inputMultiline: {
    height: 140,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  error: { color: colors.error, fontFamily: fonts.textMedium, fontSize: 15 },
  saved: { color: colors.success, fontFamily: fonts.textMedium, fontSize: 15 },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    height: 60,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryBtnText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.textBold,
    fontSize: 18,
  },
  premiumBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },
  premiumBtnText: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.displayBold,
    fontSize: 22,
  },
  premiumBtnSub: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.text,
    fontSize: 15,
    marginTop: 4,
    opacity: 0.85,
  },
  signOutBtn: { paddingVertical: spacing.lg, alignItems: "center" },
  signOutText: {
    color: colors.error,
    fontFamily: fonts.textMedium,
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
