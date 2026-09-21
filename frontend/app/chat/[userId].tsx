import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, getStoredUser } from "@/src/auth";

type Message = {
  id: string;
  conversation_id: string;
  from_id: string;
  to_id: string;
  text: string;
  created_at: string;
};

export default function Chat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const otherId = String(params.userId);
  const otherName = String(params.name || "Friend");
  const [myId, setMyId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([
        getStoredUser(),
        api<Message[]>(`/conversations/${otherId}/messages`),
      ]);
      if (me) setMyId(me.id);
      setMessages(list);
    } finally {
      setLoading(false);
    }
  }, [otherId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      const msg = await api<Message>("/messages", {
        method: "POST",
        body: JSON.stringify({ to_id: otherId, text: t }),
      });
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      setText(t);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="chat-back-button" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{otherName}</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Say hello</Text>
              <Text style={styles.emptyBody}>
                A gentle first message goes a long way.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.from_id === myId;
            return (
              <View
                testID={`message-${item.id}`}
                style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: colors.onBrandPrimary }]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <TextInput
          testID="chat-input"
          value={text}
          onChangeText={setText}
          placeholder="Write a warm message..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable
          testID="chat-send-button"
          onPress={send}
          disabled={sending || !text.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (pressed || sending || !text.trim()) && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  backBtn: { paddingVertical: 4 },
  backText: { color: colors.brandPrimary, fontFamily: fonts.textMedium, fontSize: 16 },
  title: { color: colors.onSurface, fontFamily: fonts.displayBold, fontSize: 28, marginTop: 4 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.md, gap: spacing.xs, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", marginVertical: 2 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleMine: {
    backgroundColor: colors.brandPrimary,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    color: colors.onSurface,
    fontFamily: fonts.text,
    fontSize: 17,
    lineHeight: 24,
  },
  emptyWrap: { padding: spacing.xl, alignItems: "center" },
  emptyTitle: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: 24,
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.onSurface,
    fontFamily: fonts.text,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    color: colors.onBrandSecondary,
    fontFamily: fonts.textBold,
    fontSize: 16,
  },
});
