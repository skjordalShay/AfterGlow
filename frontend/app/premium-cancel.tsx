import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";

export default function PremiumCancel() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}
      testID="premium-cancel-screen"
    >
      <Text style={styles.eyebrow}>AFTERGLOW PREMIUM</Text>
      <Text style={styles.title}>No worries.</Text>
      <Text style={styles.body}>
        Nothing was charged. Premium will be here whenever you feel ready — there is
        no hurry at all.
      </Text>
      <View style={{ flex: 1 }} />
      <Pressable
        testID="premium-cancel-retry"
        onPress={() => router.replace("/premium")}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.ctaText}>See Premium again</Text>
      </Pressable>
      <Pressable
        testID="premium-cancel-home"
        onPress={() => router.replace("/(tabs)/profile")}
        style={styles.linkBtn}
      >
        <Text style={styles.linkText}>Back to my profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  eyebrow: { color: colors.brandSecondary, fontFamily: fonts.textBold, fontSize: 12, letterSpacing: 3 },
  title: { color: colors.onSurface, fontFamily: fonts.displayBold, fontSize: 40, marginTop: spacing.md },
  body: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
    fontSize: 18,
    lineHeight: 28,
    marginTop: spacing.md,
  },
  cta: {
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontFamily: fonts.textBold, fontSize: 18 },
  linkBtn: { minHeight: 56, alignItems: "center", justifyContent: "center" },
  linkText: {
    color: colors.brandPrimary,
    fontFamily: fonts.textMedium,
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
