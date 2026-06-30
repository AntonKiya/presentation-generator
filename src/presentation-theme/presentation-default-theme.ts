export const PRESENTATION_DEFAULT_THEME = {
  id: "default",
  fonts: {
    heading: "Arial",
    body: "Arial",
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

export type PresentationTheme = typeof PRESENTATION_DEFAULT_THEME;
