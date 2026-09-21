import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { signUp } from "@/src/auth";

export default function Signup() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!firstName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp(email, password, firstName);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Pressable
          testID="signup-back-button"
          onPress={() => router.back()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          A quiet space to connect, at your own pace.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            testID="signup-firstname-input"
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g. Margaret"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="signup-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="signup-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor={colors.muted}
          />
        </View>

        {error && (
          <Text testID="signup-error" style={styles.error}>
            {error}
          </Text>
        )}

        <Pressable
          testID="signup-submit-button"
          disabled={loading}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryBtn,
            (pressed || loading) && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "Creating..." : "Create account"}
          </Text>
        </Pressable>

        <Pressable
          testID="signup-goto-login"
          onPress={() => router.replace("/login")}
          style={styles.altBtn}
        >
          <Text style={styles.altBtnText}>
            Already have an account?{" "}
            <Text style={styles.altBtnLink}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg },
  backLink: { paddingVertical: spacing.sm, marginBottom: spacing.md },
  backLinkText: { color: colors.brandPrimary, fontFamily: fonts.textMedium, fontSize: 16 },
  title: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 18,
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  label: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 15,
    marginBottom: spacing.xs,
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
  error: { color: colors.error, fontFamily: fonts.textMedium, fontSize: 15, marginBottom: spacing.md },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    height: 60,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontFamily: fonts.textBold, fontSize: 18 },
  altBtn: { paddingVertical: spacing.lg, alignItems: "center" },
  altBtnText: { color: colors.muted, fontFamily: fonts.text, fontSize: 16 },
  altBtnLink: {
    color: colors.brandPrimary,
    fontFamily: fonts.textBold,
    textDecorationLine: "underline",
  },
});
