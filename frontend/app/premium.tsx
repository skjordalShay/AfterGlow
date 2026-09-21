import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  AppState,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, API_BASE, fetchMe } from "@/src/auth";

const BENEFITS = [
  "Send unlimited waves and hearts",
  "See who has viewed your profile",
  "Access video calling for deeper conversation",
  "Priority placement in Discover",
  "Ad-free, quiet experience — always",
];

type Status = { is_premium: boolean; payment_status?: string | null };

export default function Premium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollUntil = useRef<number>(0);

  useEffect(() => {
    fetchMe().then((u) => setIsPremium(!!u?.is_premium));
  }, []);

  const poll = useCallback(async (sid: string | null) => {
    const q = sid ? `?session_id=${encodeURIComponent(sid)}` : "";
    try {
      const s = await api<Status>(`/premium/status${q}`);
      if (s.is_premium) {
        setIsPremium(true);
        setSessionId(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await fetchMe();
      }
    } catch {
      /* keep polling quietly */
    }
  }, []);

  // When the member returns from the browser, check whether payment went through.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && sessionId) poll(sessionId);
    });
    return () => sub.remove();
  }, [poll, sessionId]);

  useEffect(() => {
    if (!sessionId || isPremium) return;
    setChecking(true);
    pollUntil.current = Date.now() + 5 * 60 * 1000;
    const timer = setInterval(() => {
      if (Date.now() > pollUntil.current) {
        clearInterval(timer);
        setChecking(false);
        return;
      }
      poll(sessionId);
    }, 3000);
    return () => {
      clearInterval(timer);
      setChecking(false);
    };
  }, [poll, sessionId, isPremium]);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ url: string; session_id: string }>("/premium/checkout", {
        method: "POST",
        body: JSON.stringify({ origin_url: API_BASE }),
      });
      setSessionId(data.session_id);
      if (Platform.OS === "web") {
        window.location.assign(data.url);
      } else {
        await Linking.openURL(data.url);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not start checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root} testID="premium-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}>
        <View style={styles.hero}>
          <Image
            source={require("../assets/images/hero-heart.png")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
          />
          <LinearGradient
            colors={["rgba(34,28,43,0.1)", "rgba(34,28,43,0.95)"]}
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
            support helps us keep it that way — no ads, no distractions. Cancel
            any time.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {isPremium ? (
          <View style={styles.activeWrap} testID="premium-active-state">
            <Text style={styles.activeTitle}>✨ You're a Premium member</Text>
            <Text style={styles.activeBody}>Thank you for keeping this space warm.</Text>
            <Pressable
              testID="premium-done-button"
              onPress={() => router.replace("/(tabs)/profile")}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>Back to my profile</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.priceRow}>
              <Text style={styles.priceValue}>$5.99</Text>
              <Text style={styles.pricePeriod}> / month</Text>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            {checking && (
              <View style={styles.checkingRow} testID="premium-checking">
                <ActivityIndicator color={colors.brandPrimary} />
                <Text style={styles.checkingText}>
                  Finish in your browser — we'll confirm here automatically.
                </Text>
              </View>
            )}
            <Pressable
              testID="premium-subscribe-button"
              onPress={subscribe}
              disabled={busy || isPremium === null}
              style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>
                {busy ? "Opening secure checkout..." : "Subscribe — $5.99 / month"}
              </Text>
            </Pressable>
            <Text style={styles.secureNote}>Secure payment by Stripe. Cancel any time.</Text>
          </>
        )}
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
  backBtn: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center", paddingRight: spacing.md },
  backText: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.textMedium,
    fontSize: 17,
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
  error: { color: colors.error, fontFamily: fonts.textMedium, fontSize: 15 },
  checkingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  checkingText: { flex: 1, color: colors.muted, fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
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
  secureNote: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 14,
    textAlign: "center",
  },
  activeWrap: { gap: spacing.sm },
  activeTitle: { color: colors.onSurface, fontFamily: fonts.displayBold, fontSize: 24 },
  activeBody: { color: colors.muted, fontFamily: fonts.text, fontSize: 16 },
});
