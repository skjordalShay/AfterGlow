import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
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
      <Image
        source={require("../assets/images/app-image.png")}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        contentPosition="top"
      />
      <LinearGradient
        colors={["rgba(34,28,43,0)", "rgba(34,28,43,0.15)", "rgba(34,28,43,0.92)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]} />

      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.body}>
          A quiet place for widowed and bereaved seniors to find companionship,
          conversation, and small comforts — at your own pace.
        </Text>
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
  // Artwork sky colour — must match the PNG in every theme.
  root: { flex: 1, backgroundColor: "#2C3157" },
  content: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: "flex-start" },
  body: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 18,
    lineHeight: 28,
    opacity: 0.94,
    textAlign: "center",
    marginBottom: spacing.md,
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
