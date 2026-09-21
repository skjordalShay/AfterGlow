import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBF7",
  onSurface: "#1A1525",
  surfaceSecondary: "#F4EFEA",
  onSurfaceSecondary: "#2D2438",
  surfaceTertiary: "#EAE1D8",
  onSurfaceTertiary: "#3E324A",
  surfaceInverse: "#221C2B",
  onSurfaceInverse: "#FDFBF7",
  muted: "#5C5268",

  brand: "#342744",
  onBrand: "#FDFBF7",
  brandPrimary: "#342744",
  onBrandPrimary: "#FDFBF7",
  brandSecondary: "#D49A3E",
  onBrandSecondary: "#1A1525",
  brandTertiary: "#EADFCD",
  onBrandTertiary: "#342744",

  success: "#375945",
  onSuccess: "#FDFBF7",
  warning: "#B57A22",
  onWarning: "#FDFBF7",
  error: "#8C3B3B",
  onError: "#FDFBF7",
  info: "#4A5D73",
  onInfo: "#FDFBF7",

  border: "#EAE1D8",
  borderStrong: "#C8B8A6",
  divider: "#EAE1D8",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

// Playfair Display for display headings, system font for body — chosen for
// legibility and universal availability on iOS, Android, and web.
export const fonts = {
  display: "PlayfairDisplay",
  displayBold: "PlayfairDisplay_Bold",
  text: undefined as unknown as string, // system default
  textMedium: undefined as unknown as string,
  textBold: undefined as unknown as string,
};

export const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export const colors = light;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
