import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/auth";
import { Avatar } from "@/src/components/avatar";

type Conversation = {
  conversation_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread: boolean;
};

type Wave = {
  id: string;
  from_id: string;
  from_name: string;
  to_id: string;
  message?: string | null;
  created_at: string;
};

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Initial({ name }: { name: string }) {
  return <Avatar name={name} size={52} />;
}

export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, w] = await Promise.all([
        api<Conversation[]>("/conversations"),
        api<Wave[]>("/waves/received"),
      ]);
      setConvs(c);
      setWaves(w);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root} testID="messages-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.eyebrow}>WAVES & MESSAGES</Text>
        <Text style={styles.title}>Your conversations</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
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
              tintColor={colors.brandPrimary}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {waves.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent waves</Text>
              <View style={styles.wavesCard}>
                {waves.slice(0, 6).map((w, i) => (
                  <Pressable
                    key={w.id}
                    testID={`wave-item-${w.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/chat/[userId]",
                        params: { userId: w.from_id, name: w.from_name },
                      })
                    }
                    style={[styles.waveRow, i > 0 && styles.rowSep]}
                  >
                    <Initial name={w.from_name} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.waveName}>{w.from_name} waved at you</Text>
                      <Text style={styles.waveMsg} numberOfLines={2}>
                        {w.message || "A gentle hello."}
                      </Text>
                    </View>
                    <Text style={styles.waveTime}>{fmtTime(w.created_at)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conversations</Text>
            {convs.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyBody}>
                  Say hello to someone in Discover — a gentle wave is a lovely start.
                </Text>
                <Pressable
                  testID="messages-goto-discover"
                  onPress={() => router.push("/(tabs)")}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>Go to Discover</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.convsCard}>
                {convs.map((c, i) => (
                  <Pressable
                    key={c.conversation_id}
                    testID={`conversation-${c.other_user_id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/chat/[userId]",
                        params: { userId: c.other_user_id, name: c.other_user_name },
                      })
                    }
                    style={[styles.convRow, i > 0 && styles.rowSep]}
                  >
                    <Avatar name={c.other_user_name} uri={c.other_user_photo} size={52} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.convName}>{c.other_user_name}</Text>
                      <Text style={styles.convLast} numberOfLines={1}>
                        {c.last_message || "Say hello."}
                      </Text>
                    </View>
                    <Text style={styles.convTime}>{fmtTime(c.last_message_at)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.textBold,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wavesCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waveRow: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 80,
  },
  rowSep: { borderTopWidth: 1, borderTopColor: colors.divider },
  waveName: {
    color: colors.onSurface,
    fontFamily: fonts.textBold,
    fontSize: 17,
  },
  waveMsg: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 15,
    marginTop: 2,
    lineHeight: 22,
  },
  waveTime: { color: colors.muted, fontFamily: fonts.text, fontSize: 13 },
  convsCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  convRow: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 80,
  },
  convName: { color: colors.onSurface, fontFamily: fonts.textBold, fontSize: 18 },
  convLast: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 15,
    marginTop: 2,
  },
  convTime: { color: colors.muted, fontFamily: fonts.text, fontSize: 13 },
  emptyWrap: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    textAlign: "center",
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 16,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 24,
  },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.textBold,
    fontSize: 16,
  },
});
