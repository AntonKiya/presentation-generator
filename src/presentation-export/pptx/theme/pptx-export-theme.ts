import type { PptxExportThemeId } from "../pptx-export-contract";

export const PPTX_DEFAULT_EXPORT_THEME = {
  id: "default",
  fonts: {
    heading: "Aptos Display",
    body: "Aptos",
  },
  colors: {
    background: "FFFFFF",
    text: "111827",
    muted: "4B5563",
    border: "D1D5DB",
    surface: "F8FAFC",
    card: "FFFFFF",
    accent: "2563EB",
    accentSoft: "DBEAFE",
    chart: ["2563EB", "10B981", "F59E0B", "EF4444", "8B5CF6", "06B6D4"],
  },
  typography: {
    title: 30,
    subtitle: 18,
    body: 13,
    bullets: 14,
    cardTitle: 12,
    cardBody: 9,
    table: 8,
    chart: 9,
    placeholder: 11,
  },
  spacing: {
    cardGap: 0.12,
    cardPadding: 0.12,
    tableCellMargin: 3,
    textMargin: 4,
  },
} as const;

export type PptxExportTheme = typeof PPTX_DEFAULT_EXPORT_THEME;

const PPTX_EXPORT_THEMES = {
  default: PPTX_DEFAULT_EXPORT_THEME,
} as const satisfies Record<PptxExportThemeId, PptxExportTheme>;

export function resolvePptxExportTheme(
  themeId: PptxExportThemeId,
): PptxExportTheme {
  return PPTX_EXPORT_THEMES[themeId];
}
