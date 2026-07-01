import {
  PPTX_DEFAULT_EXPORT_THEME,
  PPTX_EXPORT_DEFAULT_OPTIONS,
  resolvePptxExportTheme,
} from "../pptx";

describe("PPTX export theme", () => {
  it("keeps the MVP default theme explicit and minimal", () => {
    const theme = resolvePptxExportTheme(PPTX_EXPORT_DEFAULT_OPTIONS.themeId);

    expect(theme).toBe(PPTX_DEFAULT_EXPORT_THEME);
    expect(theme.id).toBe("default");
    expect(theme.colors.background).toBe("F7F3EC");
    expect(theme.colors.text).toBe("1F2320");
    expect(theme.colors.accent).toBe("8F3D2E");
    expect(theme.fonts.body).toBeTruthy();
    expect(theme.typography.title).toBeGreaterThan(theme.typography.body);
    expect(theme.spacing.textMargin).toBeGreaterThan(0);
  });

  it("does not introduce additional public theme ids before they are designed", () => {
    expect(PPTX_EXPORT_DEFAULT_OPTIONS.themeId).toBe("default");
    expect(resolvePptxExportTheme("default").id).toBe("default");
  });
});
