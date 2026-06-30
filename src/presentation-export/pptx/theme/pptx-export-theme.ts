import { PRESENTATION_DEFAULT_THEME } from "../../../presentation-theme";
import type { PptxExportThemeId } from "../pptx-export-contract";

export const PPTX_DEFAULT_EXPORT_THEME = PRESENTATION_DEFAULT_THEME;

export type PptxExportTheme = typeof PPTX_DEFAULT_EXPORT_THEME;

const PPTX_EXPORT_THEMES = {
  default: PPTX_DEFAULT_EXPORT_THEME,
} as const satisfies Record<PptxExportThemeId, PptxExportTheme>;

export function resolvePptxExportTheme(
  themeId: PptxExportThemeId,
): PptxExportTheme {
  return PPTX_EXPORT_THEMES[themeId];
}
