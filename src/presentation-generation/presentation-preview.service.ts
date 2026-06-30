import { Injectable, Logger } from "@nestjs/common";
import {
  layoutUnitsToPreviewPx,
  PRESENTATION_LAYOUT_REFERENCE,
  PresentationLayoutEngineService,
  resolveCardsColumns,
  type PresentationLayoutBox,
  type PresentationLayoutNode,
  type PresentationSlideLayout,
} from "../presentation-layout";
import { PRESENTATION_DEFAULT_THEME } from "../presentation-theme";
import type { LayoutChild, LayoutContainer } from "./schemas/container-schema";
import type { Element } from "./schemas/element-schema";
import type { Presentation } from "./schemas/presentation-schema";
import type { Slide } from "./schemas/slide-schema";

@Injectable()
export class PresentationPreviewService {
  private readonly logger = new Logger(PresentationPreviewService.name);

  constructor(
    private readonly layoutEngine: PresentationLayoutEngineService = new PresentationLayoutEngineService(),
  ) {}

  renderHtml(presentation: Presentation): string {
    const startedAt = Date.now();
    const layout = this.layoutEngine.layoutPresentation(presentation);
    const html = [
      "<!doctype html>",
      '<html lang="ru">',
      "<head>",
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      `<title>${escapeHtml(presentation.title ?? "Presentation preview")}</title>`,
      `<style>${PREVIEW_CSS}</style>`,
      "</head>",
      "<body>",
      `<main class="deck">${presentation.slides
        .map((slide, index) => {
          const slideLayout = layout.slides[index];

          if (!slideLayout) {
            return "";
          }

          return this.renderSlide(slide, slideLayout, index);
        })
        .join("")}</main>`,
      "</body>",
      "</html>",
    ].join("");

    this.logger.log(
      `Preview rendered presentationId=${presentation.id} slides=${presentation.slides.length} htmlChars=${html.length} durationMs=${Date.now() - startedAt}`,
    );

    return html;
  }

  private renderSlide(
    slide: Slide,
    slideLayout: PresentationSlideLayout,
    index: number,
  ): string {
    const slideStyle = [
      `--preview-slide-width:${PRESENTATION_LAYOUT_REFERENCE.previewWidthPx}px`,
      `--preview-slide-height:${PRESENTATION_LAYOUT_REFERENCE.previewHeightPx}px`,
    ].join(";");

    return `<section class="slide" data-slide="${index + 1}" style="${slideStyle}">${this.renderContainer(
      slide.root_container,
      slideLayout.root,
      slideLayout,
    )}</section>`;
  }

  private renderChild(
    child: LayoutChild,
    layoutNode: PresentationLayoutNode,
    slideLayout: PresentationSlideLayout,
  ): string {
    if (isElement(child)) {
      return this.renderElement(child, layoutNode.box, slideLayout);
    }

    return this.renderContainer(child, layoutNode, slideLayout);
  }

  private renderContainer(
    container: LayoutContainer,
    layoutNode: PresentationLayoutNode,
    slideLayout: PresentationSlideLayout,
  ): string {
    const children = container.children as LayoutChild[];
    const layoutChildren = layoutNode.children ?? [];
    const content = children
      .map((child: LayoutChild, index: number) => {
        const childLayout = layoutChildren[index];

        if (!childLayout) {
          return "";
        }

        return this.renderChild(child, childLayout, slideLayout);
      })
      .join("");

    return `<div class="container container-${container.type}" data-node-id="${escapeHtml(
      layoutNode.nodeId,
    )}">${content}</div>`;
  }

  private renderElement(
    element: Element,
    box: PresentationLayoutBox,
    slideLayout: PresentationSlideLayout,
  ): string {
    const style = boxToCss(box, slideLayout.slideBox);

    switch (element.type) {
      case "title":
        return `<div class="element element-title" style="${style}"><h1>${escapeHtml(
          element.text,
        )}</h1></div>`;
      case "subtitle":
        return `<div class="element element-subtitle" style="${style}"><h2>${escapeHtml(
          element.text,
        )}</h2></div>`;
      case "text":
        return `<div class="element element-text" style="${style}"><p>${escapeHtml(
          element.text,
        )}</p></div>`;
      case "bullets":
        return `<div class="element element-bullets" style="${style}"><ul>${element.items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul></div>`;
      case "cards":
        return this.renderCards(element, style, slideLayout);
      case "image":
        return `<figure class="element image-placeholder" style="${style}"><div>${escapeHtml(
          element.alt,
        )}</div><figcaption>${escapeHtml(element.asset_id)}</figcaption></figure>`;
      case "table":
        return `<div class="element table-wrapper" style="${style}"><table><thead><tr>${element.columns
          .map((column) => `<th>${escapeHtml(column)}</th>`)
          .join("")}</tr></thead><tbody>${element.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`;
      case "chart":
        return `<div class="element chart" style="${style}">${renderChart(
          element,
        )}</div>`;
    }
  }

  private renderCards(
    element: Extract<Element, { type: "cards" }>,
    boxStyle: string,
    slideLayout: PresentationSlideLayout,
  ): string {
    const columns = resolveCardsColumns(element.items.length);
    const rows = Math.ceil(element.items.length / columns);
    const gap = layoutUnitsToPreviewPx(
      PRESENTATION_DEFAULT_THEME.spacing.cardGap,
      slideLayout.slideBox.w,
    );
    const padding = layoutUnitsToPreviewPx(
      PRESENTATION_DEFAULT_THEME.spacing.cardPadding,
      slideLayout.slideBox.w,
    );
    const style = [
      boxStyle,
      `--card-columns:${columns}`,
      `--card-rows:${rows}`,
      `--card-gap:${roundCss(gap)}px`,
      `--card-padding:${roundCss(padding)}px`,
    ].join(";");

    return `<div class="element cards" style="${style}">${element.items
      .map(
        (item) =>
          `<article class="card"><h3>${escapeHtml(
            item.title,
          )}</h3><p>${escapeHtml(item.text)}</p></article>`,
      )
      .join("")}</div>`;
  }
}

function isElement(child: LayoutChild): child is Element {
  return "id" in child && isElementType(child.type);
}

function isElementType(type: string): boolean {
  return [
    "title",
    "subtitle",
    "text",
    "bullets",
    "image",
    "cards",
    "table",
    "chart",
  ].includes(type);
}

function renderChart(element: Extract<Element, { type: "chart" }>): string {
  if (element.chart_type === "pie") {
    return `<strong>Pie chart</strong>${element.slices
      .map(
        (slice) =>
          `<div class="chart-row"><span>${escapeHtml(
            slice.label,
          )}</span><b>${slice.value}${escapeHtml(element.unit ?? "")}</b></div>`,
      )
      .join("")}`;
  }

  return `<strong>${element.chart_type} chart</strong>${element.series
    .map(
      (series) =>
        `<div class="chart-series"><em>${escapeHtml(series.label)}</em>${series.values
          .map((value, index) => {
            const label = element.labels[index] ?? "";

            return `<div class="chart-row"><span>${escapeHtml(
              label,
            )}</span><b>${value}${escapeHtml(element.unit ?? "")}</b></div>`;
          })
          .join("")}</div>`,
    )
    .join("")}`;
}

function boxToCss(
  box: PresentationLayoutBox,
  slideBox: PresentationLayoutBox,
): string {
  return [
    `left:${toPercent(box.x, slideBox.w)}%`,
    `top:${toPercent(box.y, slideBox.h)}%`,
    `width:${toPercent(box.w, slideBox.w)}%`,
    `height:${toPercent(box.h, slideBox.h)}%`,
  ].join(";");
}

function toPercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return roundCss((value / total) * 100);
}

function roundCss(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function ptToPx(value: number): number {
  return roundCss(value * (4 / 3));
}

function cssColor(value: string): string {
  return `#${value}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createPreviewCss(): string {
  const theme = PRESENTATION_DEFAULT_THEME;

  return `
:root {
  color-scheme: light;
  font-family: ${JSON.stringify(theme.fonts.body)}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f4f5f7;
  color: ${cssColor(theme.colors.text)};
}
* { box-sizing: border-box; }
body { margin: 0; }
.deck {
  display: grid;
  gap: 28px;
  padding: 32px;
}
.slide {
  position: relative;
  width: min(var(--preview-slide-width), calc(100vw - 64px));
  aspect-ratio: 16 / 9;
  margin: 0 auto;
  background: ${cssColor(theme.colors.background)};
  border: 1px solid #d9dee7;
  box-shadow: 0 16px 50px rgba(23, 26, 31, 0.12);
  overflow: hidden;
}
.element {
  position: absolute;
}
.container {
  display: contents;
}
.element {
  color: ${cssColor(theme.colors.text)};
  overflow: visible;
}
h1,
h2,
h3,
p,
ul,
figure {
  margin: 0;
}
h1 {
  font-family: ${JSON.stringify(theme.fonts.heading)}, ${JSON.stringify(theme.fonts.body)}, ui-sans-serif, system-ui, sans-serif;
  font-size: ${ptToPx(theme.typography.title)}px;
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: 0;
}
h2 {
  font-size: ${ptToPx(theme.typography.subtitle)}px;
  font-weight: 520;
  line-height: 1.22;
  color: ${cssColor(theme.colors.muted)};
  letter-spacing: 0;
}
h3 {
  margin: 0 0 8px;
  font-size: ${ptToPx(theme.typography.cardTitle)}px;
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: 0;
}
p,
li,
td,
th {
  font-size: ${ptToPx(theme.typography.body)}px;
  line-height: 1.32;
  letter-spacing: 0;
}
.element-bullets li {
  font-size: ${ptToPx(theme.typography.bullets)}px;
  line-height: 1.26;
}
ul {
  padding-left: 25px;
}
li + li {
  margin-top: 4px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(var(--card-columns, 1), minmax(0, 1fr));
  grid-template-rows: repeat(var(--card-rows, 1), minmax(0, 1fr));
  gap: var(--card-gap, 10px);
  overflow: hidden;
}
.card {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid ${cssColor(theme.colors.border)};
  border-radius: 8px;
  padding: var(--card-padding, 10px);
  background: ${cssColor(theme.colors.card)};
}
.card p {
  font-size: ${ptToPx(theme.typography.cardBody)}px;
  line-height: 1.24;
  color: ${cssColor(theme.colors.muted)};
}
.table-wrapper {
  overflow: hidden;
}
table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 6px 8px;
  border: 1px solid ${cssColor(theme.colors.border)};
  text-align: left;
  vertical-align: top;
  font-size: ${ptToPx(theme.typography.table)}px;
  line-height: 1.2;
}
th {
  background: ${cssColor(theme.colors.surface)};
  font-weight: 700;
}
.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed ${cssColor(theme.colors.border)};
  border-radius: 8px;
  background: ${cssColor(theme.colors.surface)};
  color: ${cssColor(theme.colors.muted)};
  text-align: center;
  overflow: hidden;
}
.image-placeholder div {
  max-width: 90%;
  font-size: ${ptToPx(theme.typography.placeholder)}px;
  line-height: 1.2;
}
.image-placeholder figcaption {
  max-width: 90%;
  margin-top: 8px;
  font-size: ${ptToPx(theme.typography.placeholder)}px;
  line-height: 1.2;
}
.chart {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid ${cssColor(theme.colors.border)};
  border-radius: 8px;
  background: ${cssColor(theme.colors.surface)};
  overflow: hidden;
}
.chart strong,
.chart em,
.chart-row {
  font-size: ${ptToPx(theme.typography.chart)}px;
}
.chart-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  border-top: 1px solid #e4e8ef;
}
`;
}

const PREVIEW_CSS = createPreviewCss();
