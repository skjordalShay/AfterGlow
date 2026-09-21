import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, getStoredUser, User } from "@/src/auth";

type Member = {
  id: string;
  first_name: string;
  zip_code?: string | null;
  about?: string | null;
  photo_url?: string | null;
};

const FALLBACK_PHOTOS = [
  "https://images.pexels.com/photos/10260353/pexels-photo-10260353.jpeg?auto=compress&cs=tinysrgb&h=650",
  "https://images.pexels.com/photos/7833703/pexels-photo-7833703.jpeg?auto=compress&cs=tinysrgb&h=650",
  "https://images.unsplash.com/photo-1604079681864-c6fbd7eb109c?auto=compress&cs=srgb&fm=jpg&w=900",
];

export default function Discover() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [waved, setWaved] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [list, u] = await Promise.all([api<Member[]>("/members"), getStoredUser()]);
      setMembers(list);
      setMe(u);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendWave(m: Member) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setWaved((s) => ({ ...s, [m.id]: true }));
    try {
      await api("/waves", {
        method: "POST",
        body: JSON.stringify({ to_id: m.id, message: "Hello — thinking warmly of you." }),
      });
    } catch {
      setWaved((s) => ({ ...s, [m.id]: false }));
    }
  }

  return (
    <View style={styles.root} testID="discover-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.eyebrow}>THE AFTERGLOW</Text>
        <Text style={styles.title}>
          {me ? `Hello, ${me.first_name}` : "Discover"}
        </Text>
        <Text style={styles.subtitle}>Quiet company, near and far.</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>The community is quiet nearby</Text>
          <Text style={styles.emptyBody}>
            Real members appear here as they join. Meanwhile, visit The Gathering
            to spend time with a group.
          </Text>
          <Pressable
            testID="discover-goto-gathering"
            onPress={() => router.push("/(tabs)/gathering")}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>Browse gatherings</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brandPrimary}
            />
          }
        >
          {members.map((m, i) => (
            <View key={m.id} style={styles.card} testID={`member-card-${m.id}`}>
              <Image
                source={{ uri: m.photo_url || FALLBACK_PHOTOS[i % FALLBACK_PHOTOS.length] }}
                style={styles.cardImage}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={["rgba(34,28,43,0)", "rgba(34,28,43,0.85)"]}
                locations={[0.35, 1]}
                style={styles.cardScrim}
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{m.first_name}</Text>
                {m.zip_code ? (
                  <Text style={styles.cardZip}>Near {m.zip_code}</Text>
                ) : null}
                {m.about ? (
                  <Text style={styles.cardAbout} numberOfLines={3}>
                    {m.about}
                  </Text>
                ) : null}
                <View style={styles.cardActions}>
                  <Pressable
                    testID={`wave-button-${m.id}`}
                    disabled={!!waved[m.id]}
                    onPress={() => sendWave(m)}
                    style={({ pressed }) => [
                      styles.waveBtn,
                      waved[m.id] && styles.waveBtnDone,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.waveBtnText,
                        waved[m.id] && { color: colors.onBrandPrimary },
                      ]}
                    >
                      {waved[m.id] ? "Wave sent ✓" : "Send a wave"}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`message-button-${m.id}`}
                    onPress={() =>
                      router.push({ pathname: "/chat/[userId]", params: { userId: m.id, name: m.first_name } })
                    }
                    style={({ pressed }) => [styles.msgBtn, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.msgBtnText}>Message</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.brandSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 12,
    letterSpacing: 3,
  },
  title: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 36,
    marginTop: 4,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 17,
    marginTop: 4,
  },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 24,
    textAlign: "center",
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 17,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 26,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: { color: colors.onBrandPrimary, fontFamily: fonts.textBold, fontSize: 17 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.md },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },
  cardImage: { width: "100%", height: 320 },
  cardScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 320 },
  cardBody: {
    padding: spacing.md,
    paddingTop: 0,
    marginTop: -100,
  },
  cardName: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.displayBold,
    fontSize: 28,
  },
  cardZip: {
    color: colors.brandSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 15,
    marginTop: 2,
  },
  cardAbout: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.text,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
    opacity: 0.92,
  },
  cardActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  waveBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  waveBtnDone: { backgroundColor: colors.brandPrimary },
  waveBtnText: {
    color: colors.onBrandSecondary,
    fontFamily: fonts.textBold,
    fontSize: 16,
  },
  msgBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.onSurfaceInverse,
    alignItems: "center",
    justifyContent: "center",
  },
  msgBtnText: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.textBold,
    fontSize: 16,
  },
});
