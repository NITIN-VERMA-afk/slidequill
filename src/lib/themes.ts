export type TitleSlideStyle = "center" | "left" | "split";

export interface FontDef {
  name: string;      // Google Font name (e.g. 'Inter', 'Merriweather')
  fallback: string;  // PPTX safe fallback (e.g. 'Arial', 'Georgia', 'Calibri')
}

export interface ThemeColors {
  bg: string;          // Hex color
  surface: string;     // Hex color (for cards, shapes, split bg)
  text: string;        // Hex color
  mutedText: string;   // Hex color
  accent: string;      // Hex color
  accent2: string;     // Hex color
}

export interface ThemeDef {
  id: string;
  name: string;
  colors: ThemeColors;
  headingFont: FontDef;
  bodyFont: FontDef;
  titleSlideStyle: TitleSlideStyle;
  cornerRadius: number; // in cqws (or px representation)
}

export const themes: Record<string, ThemeDef> = {
  modern: {
    id: "modern",
    name: "Modern Minimal",
    colors: {
      bg: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      mutedText: "#64748b",
      accent: "#2563eb",
      accent2: "#3b82f6",
    },
    headingFont: { name: "Inter", fallback: "Arial" },
    bodyFont: { name: "Inter", fallback: "Arial" },
    titleSlideStyle: "center",
    cornerRadius: 1, // small rounding
  },
  corporate: {
    id: "corporate",
    name: "Corporate Executive",
    colors: {
      bg: "#f8fafc",
      surface: "#ffffff",
      text: "#1e293b",
      mutedText: "#475569",
      accent: "#0f172a", // Dark slate for strong accents
      accent2: "#334155",
    },
    headingFont: { name: "Playfair Display", fallback: "Georgia" },
    bodyFont: { name: "Source Sans Pro", fallback: "Arial" },
    titleSlideStyle: "left",
    cornerRadius: 0, // sharp edges
  },
  creative: {
    id: "creative",
    name: "Creative Studio",
    colors: {
      bg: "#fffbeb", // warm amber tint
      surface: "#ffffff",
      text: "#1c1917", // warm dark text
      mutedText: "#78716c",
      accent: "#e11d48", // rose accent
      accent2: "#f43f5e",
    },
    headingFont: { name: "Space Grotesk", fallback: "Arial" },
    bodyFont: { name: "Outfit", fallback: "Calibri" },
    titleSlideStyle: "split",
    cornerRadius: 3, // very rounded
  },
  dark: {
    id: "dark",
    name: "Midnight Pitch",
    colors: {
      bg: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      mutedText: "#a1a1aa",
      accent: "#3b82f6", // bright blue
      accent2: "#60a5fa",
    },
    headingFont: { name: "Outfit", fallback: "Calibri" },
    bodyFont: { name: "Inter", fallback: "Arial" },
    titleSlideStyle: "left",
    cornerRadius: 1.5,
  },
  playful: {
    id: "playful",
    name: "Startup Playful",
    colors: {
      bg: "#fdf4ff", // subtle fuchsia
      surface: "#ffffff",
      text: "#4a044e",
      mutedText: "#86198f",
      accent: "#c026d3", // fuchsia accent
      accent2: "#e879f9",
    },
    headingFont: { name: "Fredoka", fallback: "Arial" },
    bodyFont: { name: "Nunito", fallback: "Calibri" },
    titleSlideStyle: "center",
    cornerRadius: 4,
  },
  elegant: {
    id: "elegant",
    name: "Elegant Report",
    colors: {
      bg: "#fafaf9",
      surface: "#f5f5f4",
      text: "#292524",
      mutedText: "#57534e",
      accent: "#166534", // forest green
      accent2: "#22c55e",
    },
    headingFont: { name: "Merriweather", fallback: "Georgia" },
    bodyFont: { name: "Lora", fallback: "Georgia" },
    titleSlideStyle: "split",
    cornerRadius: 0,
  },
};

export const defaultThemeId = "modern";

export function getTheme(id: string): ThemeDef {
  return themes[id] || themes[defaultThemeId];
}
