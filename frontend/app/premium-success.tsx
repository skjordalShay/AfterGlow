import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { API_BASE, fetchMe, getToken } from "@/src/auth";

type State = "checking" | "confirmed" | "pending";

export default function PremiumSuccess() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const [state, setState] = useState<State>("checking");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    getToken().then((t) => setSignedIn(!!t));
  }, []);

  useEffect(() => {
    if (!session_id) {
      setState("pending");
      return;
    }
    let attempts = 0;
    let cancelled = false;
    const check = async () => {
      attempts += 1;
      try {
        const r = await fetch(
          `${API_BASE}/api/premium/confirm?session_id=${encodeURIComponent(String(session_id))}`,
        );
        const data = await r.json();
        if (!cancelled && data.is_premium) {
          setState("confirmed");
          await fetchMe();
          return;
        }
      } catch {
        /* retry */
      }
      if (!cancelled) {
        if (attempts < 20) setTimeout(check, 3000);
        else setState("pending");
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [session_id]);

  return (
    <View style={styles.root} testID="premium-success-screen">
      <LinearGradient
        colors={[colors.brand, colors.surfaceInverse]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.eyebrow}>AFTERGLOW PREMIUM</Text>
        {state === "checking" && (
          <>
            <Text style={styles.title}>Thank you.</Text>
            <ActivityIndicator color={colors.brandSecondary} size="large" style={{ marginVertical: spacing.lg }} />
            <Text style={styles.body}>Confirming your subscription — this only takes a moment.</Text>
          </>
        )}
        {state === "confirmed" && (
          <>
            <Text style={styles.title}>Welcome to Premium ✨</Text>
            <Text style={styles.body}>
              Your support keeps The Afterglow calm, kind, and ad-free. Everything is now unlocked.
            </Text>
          </>
        )}
        {state === "pending" && (
          <>
            <Text style={styles.title}>Payment received</Text>
            <Text style={styles.body}>
              We're still confirming with our payment provider. Your Premium will appear in the app shortly.
            </Text>
          </>
        )}

        <View style={{ flex: 1 }} />
        {signedIn ? (
          <Pressable
            testID="premium-success-continue"
            onPress={() => router.replace("/(tabs)/profile")}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Continue to my profile</Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>You can close this page and return to The Afterglow app.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  eyebrow: { color: colors.brandSecondary, fontFamily: fonts.textBold, fontSize: 12, letterSpacing: 3 },
  title: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 46,
    marginTop: spacing.md,
  },
  body: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 18,
    lineHeight: 28,
    marginTop: spacing.md,
    opacity: 0.92,
  },
  hint: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  cta: {
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: colors.onBrandSecondary, fontFamily: fonts.textBold, fontSize: 18 },
});
