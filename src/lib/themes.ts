export type TitleSlideStyle = "center" | "left" | "split";

export interface FontDef {
  name: string;      // Native PowerPoint safe font name (e.g. 'Arial', 'Calibri', 'Georgia', 'Trebuchet MS')
  fallback: string;  // CSS fallback stack (e.g. 'sans-serif', 'serif')
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
  description: string;
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
    description: "Clean, spacious slides with beautiful typography and a crisp white palette.",
    colors: {
      bg: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      mutedText: "#64748b",
      accent: "#2563eb",
      accent2: "#3b82f6",
    },
    headingFont: { name: "Arial", fallback: "sans-serif" },
    bodyFont: { name: "Calibri", fallback: "sans-serif" },
    titleSlideStyle: "center",
    cornerRadius: 1, // small rounding
  },
  corporate: {
    id: "corporate",
    name: "Corporate Executive",
    description: "Professional and structured with serif fonts. Perfect for reports and executive decks.",
    colors: {
      bg: "#f8fafc",
      surface: "#ffffff",
      text: "#1e293b",
      mutedText: "#475569",
      accent: "#0f172a", // Dark slate for strong accents
      accent2: "#334155",
    },
    headingFont: { name: "Georgia", fallback: "serif" },
    bodyFont: { name: "Calibri", fallback: "sans-serif" },
    titleSlideStyle: "left",
    cornerRadius: 0, // sharp edges
  },
  creative: {
    id: "creative",
    name: "Creative Studio",
    description: "Warm tones, bold rose accents, and expressive typography for creative work.",
    colors: {
      bg: "#fffbeb", // warm amber tint
      surface: "#ffffff",
      text: "#1c1917", // warm dark text
      mutedText: "#78716c",
      accent: "#e11d48", // rose accent
      accent2: "#f43f5e",
    },
    headingFont: { name: "Trebuchet MS", fallback: "sans-serif" },
    bodyFont: { name: "Calibri", fallback: "sans-serif" },
    titleSlideStyle: "split",
    cornerRadius: 3, // very rounded
  },
  dark: {
    id: "dark",
    name: "Midnight Pitch",
    description: "High-contrast dark background with bright blue accents. Great for pitch decks.",
    colors: {
      bg: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      mutedText: "#a1a1aa",
      accent: "#3b82f6", // bright blue
      accent2: "#60a5fa",
    },
    headingFont: { name: "Trebuchet MS", fallback: "sans-serif" },
    bodyFont: { name: "Arial", fallback: "sans-serif" },
    titleSlideStyle: "left",
    cornerRadius: 1.5,
  },
  playful: {
    id: "playful",
    name: "Startup Playful",
    description: "Fuchsia accents and rounded fonts. Ideal for startups and product launches.",
    colors: {
      bg: "#fdf4ff", // subtle fuchsia
      surface: "#ffffff",
      text: "#4a044e",
      mutedText: "#86198f",
      accent: "#c026d3", // fuchsia accent
      accent2: "#e879f9",
    },
    headingFont: { name: "Trebuchet MS", fallback: "sans-serif" },
    bodyFont: { name: "Calibri", fallback: "sans-serif" },
    titleSlideStyle: "center",
    cornerRadius: 4,
  },
  elegant: {
    id: "elegant",
    name: "Elegant Report",
    description: "Earthy tones with forest green accents and classic serif fonts for polished reports.",
    colors: {
      bg: "#fafaf9",
      surface: "#f5f5f4",
      text: "#292524",
      mutedText: "#57534e",
      accent: "#166534", // forest green
      accent2: "#22c55e",
    },
    headingFont: { name: "Palatino Linotype", fallback: "Georgia, serif" },
    bodyFont: { name: "Georgia", fallback: "serif" },
    titleSlideStyle: "split",
    cornerRadius: 0,
  },
};

export const defaultThemeId = "modern";

export function getTheme(id: string): ThemeDef {
  return themes[id] || themes[defaultThemeId];
}
