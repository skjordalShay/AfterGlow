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
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/auth";

type Gathering = {
  id: string;
  category: string;
  title: string;
  host: string;
  starts_at: string;
  duration_minutes: number;
  image_url?: string | null;
  description?: string | null;
};

const CATEGORIES = ["All", "Wellness", "Exercise", "Arts", "Social", "History"];

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { day, date, time };
}

export default function GatheringScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Gathering[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("All");
  const [rsvpd, setRsvpd] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const list = await api<Gathering[]>("/gatherings");
      setItems(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    category === "All" ? items : items.filter((i) => i.category === category);

  return (
    <View style={styles.root} testID="gathering-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.eyebrow}>THE GATHERING</Text>
        <Text style={styles.title}>Come sit with us</Text>
        <Text style={styles.subtitle}>
          Warm classes and conversations, gently guided.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((c) => {
            const selected = c === category;
            return (
              <Pressable
                key={c}
                testID={`chip-${c}`}
                onPress={() => setCategory(c)}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
                    : {},
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected ? { color: colors.onBrandPrimary } : {},
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
          {filtered.map((g) => {
            const d = formatDate(g.starts_at);
            const done = !!rsvpd[g.id];
            return (
              <View key={g.id} style={styles.card} testID={`gathering-card-${g.id}`}>
                {g.image_url ? (
                  <Image
                    source={{ uri: g.image_url }}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : null}
                <View style={styles.cardBody}>
                  <View style={styles.datePill}>
                    <Text style={styles.datePillDay}>{d.day.toUpperCase()}</Text>
                    <Text style={styles.datePillDate}>{d.date}</Text>
                    <Text style={styles.datePillTime}>{d.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCategory}>{g.category}</Text>
                    <Text style={styles.cardTitle}>{g.title}</Text>
                    <Text style={styles.cardHost}>with {g.host}</Text>
                    {g.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {g.description}
                      </Text>
                    ) : null}
                    <Pressable
                      testID={`rsvp-button-${g.id}`}
                      onPress={() => setRsvpd((s) => ({ ...s, [g.id]: !done }))}
                      style={({ pressed }) => [
                        styles.rsvpBtn,
                        done && styles.rsvpDone,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.rsvpBtnText, done && { color: colors.onBrandPrimary }]}>
                        {done ? "You're going ✓" : "RSVP"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No {category} gatherings just yet</Text>
              <Text style={styles.emptyBody}>Try another category or check back soon.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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
    marginBottom: spacing.md,
  },
  chipsRow: { gap: spacing.xs, paddingRight: spacing.lg, paddingVertical: spacing.xs },
  chip: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  chipText: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.textMedium,
    fontSize: 15,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: { width: "100%", height: 140 },
  cardBody: {
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
  },
  datePill: {
    width: 76,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  datePillDay: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.textBold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  datePillDate: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    marginTop: 2,
  },
  datePillTime: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.textMedium,
    fontSize: 13,
    marginTop: 4,
  },
  cardCategory: {
    color: colors.brandSecondary,
    fontFamily: fonts.textBold,
    fontSize: 12,
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 4,
  },
  cardHost: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 15,
    marginTop: 2,
  },
  cardDesc: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  rsvpBtn: {
    marginTop: spacing.sm,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  rsvpDone: { backgroundColor: colors.brandPrimary },
  rsvpBtnText: { color: colors.onBrandSecondary, fontFamily: fonts.textBold, fontSize: 15 },
  emptyWrap: { padding: spacing.xl, alignItems: "center" },
  emptyTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    textAlign: "center",
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 16,
    marginTop: spacing.xs,
    textAlign: "center",
  },
});
