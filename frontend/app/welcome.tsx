import { View, Text, StyleSheet, Pressable, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root} testID="welcome-screen">
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1604079681864-c6fbd7eb109c?auto=compress&cs=srgb&fm=jpg&w=1200",
        }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(34,28,43,0.35)", "rgba(34,28,43,0.85)", "rgba(34,28,43,0.98)"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        <Text style={styles.eyebrow}>THE</Text>
        <Text style={styles.title}>Afterglow</Text>
        <Text style={styles.tagline}>gentle connection in the light after loss</Text>

        <Text style={styles.body}>
          A quiet place for widowed and bereaved seniors to find companionship,
          conversation, and small comforts — at your own pace.
        </Text>
      </View>

      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          testID="welcome-signup-button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push("/signup");
          }}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.primaryBtnText}>Create your account</Text>
        </Pressable>

        <Pressable
          testID="welcome-login-button"
          onPress={() => router.push("/login")}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: "flex-start" },
  eyebrow: {
    color: colors.brandSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 14,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.displayBold,
    fontSize: 56,
    lineHeight: 60,
    marginBottom: spacing.md,
  },
  tagline: {
    color: colors.brandSecondary,
    fontFamily: fonts.display,
    fontSize: 20,
    marginBottom: spacing.xl,
    fontStyle: "italic",
  },
  body: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 18,
    lineHeight: 28,
    opacity: 0.92,
  },
  ctaWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.brandSecondary,
    height: 60,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.onBrandSecondary,
    fontFamily: fonts.textBold,
    fontSize: 18,
  },
  secondaryBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.textMedium,
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
