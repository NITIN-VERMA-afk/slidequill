/**
 * src/lib/layout-constants.ts
 *
 * Shared layout constants, geometry ratios, font metrics, and text fitting logic
 * for both SlideRenderer (web preview) and pptx.ts (PowerPoint export).
 */

export const SLIDE_ASPECT_RATIO = 16 / 9; // 1.77778
export const PPTX_WIDTH_INCHES = 13.333;
export const PPTX_HEIGHT_INCHES = 7.5;
export const PPTX_WIDTH_POINTS = PPTX_WIDTH_INCHES * 72; // 960 pt
export const PPTX_HEIGHT_POINTS = PPTX_HEIGHT_INCHES * 72; // 540 pt

/**
 * Standard slide layout coordinates (unitless ratios relative to slide width & height [0.0 - 1.0]).
 */
export const LAYOUT_RATIOS = {
  // Global slide margins
  margin: {
    x: 0.05, // 5%
    top: 0.04, // 4%
    bottom: 0.05, // 5%
    contentWidth: 0.90, // 90%
  },

  // Standard slide header (title + underline pill)
  header: {
    x: 0.05,
    y: 0.04,
    w: 0.90,
    h: 0.12,
    titleFontSizePt: 28,
    titleFontSizeCqw: 3.8,
    underline: {
      x: 0.05,
      y: 0.16,
      w: 0.10, // 10%
      h: 0.008, // ~0.8%
    },
  },

  // Standard content area bounds
  contentArea: {
    x: 0.05,
    y: 0.20,
    w: 0.90,
    h: 0.72,
  },

  // Title Slide variants
  titleSlide: {
    center: {
      titleY: 0.34,
      titleH: 0.22,
      titleFontSizePt: 44,
      titleFontSizeCqw: 6.5,
      subtitleY: 0.58,
      subtitleH: 0.12,
      subtitleFontSizePt: 22,
      subtitleFontSizeCqw: 3.2,
    },
    left: {
      x: 0.08,
      w: 0.84,
      titleY: 0.32,
      titleH: 0.22,
      titleFontSizePt: 44,
      titleFontSizeCqw: 6.5,
      subtitleY: 0.56,
      subtitleH: 0.12,
      subtitleFontSizePt: 22,
      subtitleFontSizeCqw: 3.2,
    },
    split: {
      leftCard: { x: 0.0, y: 0.0, w: 0.50, h: 1.0 },
      titleX: 0.06,
      titleY: 0.28,
      titleW: 0.40,
      titleH: 0.26,
      titleFontSizePt: 38,
      titleFontSizeCqw: 5.5,
      subtitleX: 0.06,
      subtitleY: 0.56,
      subtitleW: 0.40,
      subtitleH: 0.16,
      subtitleFontSizePt: 20,
      subtitleFontSizeCqw: 2.8,
      rightDecor: { x: 0.65, y: 0.28, w: 0.20, h: 0.36 },
    },
  },

  // Bullets Layout
  bullets: {
    x: 0.05,
    y: 0.22,
    w: 0.90,
    h: 0.68,
    fontSizePt: 22,
    fontSizeCqw: 3.4,
    minFontSizePt: 16,
  },

  // Two Column Layout
  twoColumn: {
    y: 0.22,
    h: 0.68,
    cardRadius: 0.05,
    col1: { x: 0.05, w: 0.43 },
    col2: { x: 0.52, w: 0.43 },
    paddingX: 0.03,
    paddingY: 0.03,
    headingH: 0.08,
    headingFontSizePt: 22,
    headingFontSizeCqw: 2.8,
    bulletsTopOffset: 0.10,
    bulletsFontSizePt: 18,
    bulletsFontSizeCqw: 2.3,
    minFontSizePt: 14,
  },

  // Stats Layout
  stats: {
    y: 0.24,
    h: 0.64,
    cardRadius: 0.05,
    valFontSizePt: 42,
    valFontSizeCqw: 7.0,
    minValFontSizePt: 28,
    lblFontSizePt: 18,
    lblFontSizeCqw: 2.2,
    minLblFontSizePt: 13,
  },

  // Process Layout
  process: {
    y: 0.24,
    h: 0.64,
    lineY: 0.32,
    lineH: 0.008,
    badgeY: 0.28,
    badgeDiameterPt: 40,
    labelY: 0.44,
    labelFontSizePt: 20,
    labelFontSizeCqw: 2.5,
    descY: 0.56,
    descFontSizePt: 15,
    descFontSizeCqw: 1.8,
    minDescFontSizePt: 12,
  },

  // Comparison Layout
  comparison: {
    y: 0.22,
    h: 0.68,
    accentLineH: 0.008,
    headingFontSizePt: 22,
    headingFontSizeCqw: 2.8,
    bulletsFontSizePt: 17,
    bulletsFontSizeCqw: 2.3,
    minFontSizePt: 13,
  },

  // Quote Layout
  quote: {
    x: 0.10,
    w: 0.80,
    quoteY: 0.26,
    quoteH: 0.40,
    quoteFontSizePt: 28,
    quoteFontSizeCqw: 4.2,
    minQuoteFontSizePt: 20,
    attribY: 0.68,
    attribH: 0.12,
    attribFontSizePt: 18,
    attribFontSizeCqw: 2.4,
  },

  // Closing Layout
  closing: {
    x: 0.10,
    w: 0.80,
    headlineY: 0.30,
    headlineH: 0.24,
    headlineFontSizePt: 42,
    headlineFontSizeCqw: 6.0,
    ctaY: 0.58,
    ctaW: 0.32,
    ctaH: 0.12,
    ctaFontSizePt: 22,
    ctaFontSizeCqw: 2.8,
  },
};

/**
 * Character width estimation factors relative to font size (em width).
 * PowerPoint native fonts average widths:
 */
export const FONT_WIDTH_FACTORS: Record<string, number> = {
  Arial: 0.52,
  Calibri: 0.48,
  Georgia: 0.55,
  "Trebuchet MS": 0.54,
  "Palatino Linotype": 0.53,
  Cambria: 0.51,
  default: 0.50,
};

export function getFontWidthFactor(fontFace: string): number {
  return FONT_WIDTH_FACTORS[fontFace] || FONT_WIDTH_FACTORS.default;
}

/**
 * Estimates wrapped line count for a given text string inside a container width.
 */
export function estimateWrappedLines(
  text: string,
  boxWidthPoints: number,
  fontSizePoints: number,
  fontFace: string = "default"
): number {
  if (!text || !text.trim()) return 0;
  const factor = getFontWidthFactor(fontFace);
  const avgCharWidthPoints = fontSizePoints * factor;
  const charsPerLine = Math.max(1, Math.floor(boxWidthPoints / avgCharWidthPoints));

  // Count explicit newlines first
  const paragraphs = text.split("\n");
  let totalLines = 0;
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) {
      totalLines += 1;
    } else {
      totalLines += Math.max(1, Math.ceil(trimmed.length / charsPerLine));
    }
  }
  return totalLines;
}

/**
 * Calculates optimal auto-fit font size stepping down gracefully.
 */
export function calculateFittedFontSize(
  text: string,
  boxWidthPoints: number,
  boxHeightPoints: number,
  initialFontSize: number,
  minFontSize: number,
  fontFace: string = "default",
  lineHeightFactor: number = 1.3
): number {
  let size = initialFontSize;
  while (size > minFontSize) {
    const lines = estimateWrappedLines(text, boxWidthPoints, size, fontFace);
    const requiredHeight = lines * size * lineHeightFactor;
    if (requiredHeight <= boxHeightPoints) {
      return size;
    }
    size -= 2;
  }
  return minFontSize;
}

/**
 * Helper to convert ratio [0.0 - 1.0] to PPTX coordinate string (e.g. 0.05 -> "5%")
 */
export function toPercentStr(ratio: number): `${number}%` {
  const rounded = Math.round(ratio * 1000) / 10;
  return `${rounded}%` as `${number}%`;
}

/**
 * Helper to convert ratio [0.0 - 1.0] to CSS cqw string (e.g. 0.05 -> "5cqw")
 */
export function toCqwStr(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}cqw`;
}
