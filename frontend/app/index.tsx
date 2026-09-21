import { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "@/src/theme";
import { getToken, fetchMe } from "@/src/auth";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) {
        router.replace("/welcome");
        return;
      }
      const u = await fetchMe();
      if (u) router.replace("/(tabs)");
      else router.replace("/welcome");
    })();
  }, [router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
