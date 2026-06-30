export const PPTX_LAYOUT_REFERENCE = {
  previewWidthPx: 1120,
  previewHeightPx: 630,
  safeAreaPx: 56,
} as const;

export const PPTX_LAYOUT_LIMITS = {
  maxAutoGridColumns: 4,
  minRenderableWidth: 0.35,
  minRenderableHeight: 0.25,
} as const;

export const PPTX_LAYOUT_ELEMENT_HEIGHTS = {
  title: 0.72,
  subtitle: 0.46,
  textMin: 0.65,
  textCharsPerLine: 58,
  textLineHeight: 0.28,
  bulletsBase: 0.2,
  bulletItemHeight: 0.32,
  image: 1.8,
  cardsBase: 0.8,
  cardItemHeight: 0.5,
  tableHeaderHeight: 0.38,
  tableRowHeight: 0.32,
  chart: 2.2,
} as const;
