import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";

const BENEFITS = [
  "Send unlimited waves and hearts",
  "See who has viewed your profile",
  "Access video calling for deeper conversation",
  "Priority placement in Discover",
  "Ad-free, quiet experience — always",
];

export default function Premium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root} testID="premium-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.hero}>
          <Image
            source={{
              uri: "https://images.pexels.com/photos/10260353/pexels-photo-10260353.jpeg?auto=compress&cs=tinysrgb&h=650",
            }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(34,28,43,0.2)", "rgba(34,28,43,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.md }]}>
            <Pressable
              testID="premium-back-button"
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>AFTERGLOW PREMIUM</Text>
              <Text style={styles.title}>Unlock deeper{"\n"}connection</Text>
              <Text style={styles.subtitle}>
                Support the community and enjoy more thoughtful features.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <View style={styles.check}>
                <Text style={styles.checkText}>✓</Text>
              </View>
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>A gentle promise</Text>
          <Text style={styles.noteBody}>
            The Afterglow will always remain a calm, respectful space. Premium
            support helps us keep it that way — no ads, no distractions.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View style={styles.priceRow}>
          <Text style={styles.priceValue}>$5.99</Text>
          <Text style={styles.pricePeriod}> / month</Text>
        </View>
        <Pressable
          testID="premium-subscribe-button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaText}>Coming soon</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 380, overflow: "hidden" },
  heroContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: "space-between",
  },
  backBtn: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  backText: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.textMedium,
    fontSize: 16,
  },
  heroText: { gap: spacing.xs },
  eyebrow: {
    color: colors.brandSecondary,
    fontFamily: fonts.textBold,
    fontSize: 12,
    letterSpacing: 3,
  },
  title: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 44,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 17,
    lineHeight: 26,
    opacity: 0.9,
    marginTop: spacing.xs,
  },
  benefits: { padding: spacing.lg, gap: spacing.md },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.textBold,
    fontSize: 18,
  },
  benefitText: {
    flex: 1,
    color: colors.onSurface,
    fontFamily: fonts.text,
    fontSize: 18,
    lineHeight: 26,
  },
  note: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  noteBody: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  priceValue: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 32,
  },
  pricePeriod: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 17,
  },
  cta: {
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.textBold,
    fontSize: 18,
  },
});
