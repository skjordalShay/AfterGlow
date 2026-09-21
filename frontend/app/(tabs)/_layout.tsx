import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/src/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text
        style={[
          styles.iconLabel,
          { color: focused ? colors.brandPrimary : colors.muted },
        ]}
      >
        {label}
      </Text>
      {focused ? <View style={styles.dot} /> : <View style={styles.dotPh} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
        },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => <TabIcon label="Discover" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gathering"
        options={{
          title: "Gathering",
          tabBarIcon: ({ focused }) => <TabIcon label="Gathering" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ focused }) => <TabIcon label="Messages" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", width: 84, gap: 4 },
  iconLabel: { fontFamily: fonts.textMedium, fontSize: 13, letterSpacing: 0.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brandSecondary },
  dotPh: { width: 4, height: 4 },
});
