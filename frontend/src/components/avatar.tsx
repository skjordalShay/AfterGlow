import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

import { colors, fonts } from "@/src/theme";
import { photoUri } from "@/src/auth";

type Props = {
  name: string;
  uri?: string | null;
  size?: number;
  testID?: string;
};

export function Avatar({ name, uri, size = 52, testID }: Props) {
  const resolved = photoUri(uri);
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (resolved) {
    return (
      <Image
        testID={testID}
        source={{ uri: resolved }}
        style={[styles.photo, round]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View testID={testID} style={[styles.initial, round]}>
      <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>
        {(name || "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.surfaceTertiary },
  initial: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    color: colors.onBrandTertiary,
    fontFamily: fonts.displayBold,
  },
});
