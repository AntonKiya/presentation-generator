import { Injectable, Logger } from "@nestjs/common";
import {
  getDefaultPresentationIconDataUrl,
  getDefaultPresentationImageDataUrl,
} from "../presentation-assets";
import {
  getBulletsInternalLayout,
  getCardsInternalLayout,
  PRESENTATION_LAYOUT_REFERENCE,
  PresentationLayoutEngineService,
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
      return this.renderElement(child, layoutNode, slideLayout);
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
    )}">${content}${renderTitleAccentLine(container, layoutNode, slideLayout)}</div>`;
  }

  private renderElement(
    element: Element,
    layoutNode: PresentationLayoutNode,
    slideLayout: PresentationSlideLayout,
  ): string {
    const box = layoutNode.box;
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
        return this.renderBullets(element, layoutNode, slideLayout);
      case "cards":
        return this.renderCards(element, layoutNode, slideLayout);
      case "image":
        return this.renderImage(element, style);
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
    layoutNode: PresentationLayoutNode,
    slideLayout: PresentationSlideLayout,
  ): string {
    const internalLayout = getCardsInternalLayout(layoutNode);
    const boxStyle = boxToCss(layoutNode.box, slideLayout.slideBox);

    if (!internalLayout) {
      return `<div class="element cards cards-fallback" style="${boxStyle}">${element.items
        .map(
          (item) =>
            `<article class="card"><h3>${escapeHtml(
              item.title,
            )}</h3><p>${escapeHtml(item.text)}</p></article>`,
        )
        .join("")}</div>`;
    }

    return `<div class="element cards" style="${boxStyle}">${internalLayout.items
      .map(
        (item) =>
          `<article class="card card-${item.variant}" style="${boxToCssWithin(
            item.cardBox,
            layoutNode.box,
          )}">${renderCardIcon(item, layoutNode)}<h3 style="${boxToCssWithin(
            item.titleBox,
            item.cardBox,
          )};${textStyleToCss(
            item.titleFontSize,
            item.titleLineHeightMultiple,
          )}">${escapeHtml(
            item.title,
          )}</h3><p style="${boxToCssWithin(
            item.bodyBox,
            item.cardBox,
          )};${textStyleToCss(
            item.bodyFontSize,
            item.bodyLineHeightMultiple,
          )}">${escapeHtml(
            item.text,
          )}</p></article>`,
      )
      .join("")}</div>`;
  }

  private renderBullets(
    element: Extract<Element, { type: "bullets" }>,
    layoutNode: PresentationLayoutNode,
    slideLayout: PresentationSlideLayout,
  ): string {
    const internalLayout = getBulletsInternalLayout(layoutNode);
    const boxStyle = boxToCss(layoutNode.box, slideLayout.slideBox);

    if (!internalLayout) {
      return `<div class="element element-bullets bullet-list-fallback" style="${boxStyle}">${element.items
        .map(
          (item) =>
            `<div class="bullet-item"><span class="bullet-marker"></span><span class="bullet-text">${escapeHtml(
              item,
            )}</span></div>`,
        )
        .join("")}</div>`;
    }

    return `<div class="element element-bullets" style="${boxStyle}">${internalLayout.items
      .map(
        (item) => `<div class="bullet-item" style="${boxToCssWithin(
          item.itemBox,
          layoutNode.box,
        )}"><span class="bullet-marker" style="${boxToCssWithin(
          item.markerBox,
          item.itemBox,
        )};font-size:${ptToPx(
          item.markerFontSize,
        )}px">→</span><span class="bullet-text" style="${boxToCssWithin(
          item.textBox,
          item.itemBox,
        )};${textStyleToCss(
          item.textFontSize,
          item.textLineHeightMultiple,
        )}">${escapeHtml(item.text)}</span></div>`,
      )
      .join("")}</div>`;
  }

  private renderImage(
    element: Extract<Element, { type: "image" }>,
    style: string,
  ): string {
    const imageDataUrl = getDefaultPresentationImageDataUrl();

    if (imageDataUrl) {
      return `<figure class="element image-frame" style="${style}"><img src="${imageDataUrl}" alt="${escapeHtml(
        element.alt,
      )}" /></figure>`;
    }

    return `<figure class="element image-placeholder" style="${style}"><div>${escapeHtml(
      element.alt,
    )}</div></figure>`;
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

function renderTitleAccentLine(
  container: LayoutContainer,
  layoutNode: PresentationLayoutNode,
  slideLayout: PresentationSlideLayout,
): string {
  if (container.slot !== "title") {
    return "";
  }

  const { spacing } = PRESENTATION_DEFAULT_THEME;
  const accentBox = {
    x: layoutNode.box.x,
    y: layoutNode.box.y + layoutNode.box.h + spacing.titleAccentGap,
    w: Math.min(spacing.titleAccentWidth, layoutNode.box.w),
    h: spacing.titleAccentHeight,
  };

  return `<div class="title-accent-line" style="${boxToCss(
    accentBox,
    slideLayout.slideBox,
  )}"></div>`;
}

function renderCardIcon(
  item: NonNullable<ReturnType<typeof getCardsInternalLayout>>["items"][number],
  layoutNode: PresentationLayoutNode,
): string {
  if (!item.iconBox) {
    return "";
  }

  const iconDataUrl = getDefaultPresentationIconDataUrl();
  const iconContent = iconDataUrl
    ? `<img src="${iconDataUrl}" alt="" />`
    : "<span>✦</span>";

  return `<span class="card-icon" style="${boxToCssWithin(
    item.iconBox,
    item.cardBox,
  )}">${iconContent}</span>`;
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

function boxToCssWithin(
  box: PresentationLayoutBox,
  parentBox: PresentationLayoutBox,
): string {
  return boxToCss(
    {
      x: box.x - parentBox.x,
      y: box.y - parentBox.y,
      w: box.w,
      h: box.h,
    },
    {
      x: 0,
      y: 0,
      w: parentBox.w,
      h: parentBox.h,
    },
  );
}

function textStyleToCss(fontSizePt: number, lineHeightMultiple: number): string {
  return `font-size:${ptToPx(fontSizePt)}px;line-height:${roundCss(
    lineHeightMultiple,
  )}`;
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
  font-weight: 500;
  line-height: 1.03;
  letter-spacing: 0;
  color: ${cssColor(theme.colors.accent)};
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
td,
th {
  font-size: ${ptToPx(theme.typography.body)}px;
  line-height: 1.32;
  letter-spacing: 0;
}
.title-accent-line {
  position: absolute;
  border-radius: 999px;
  background: ${cssColor(theme.colors.accent)};
  opacity: 0.85;
}
.element-bullets {
  position: absolute;
  overflow: hidden;
}
.bullet-item {
  position: absolute;
  overflow: hidden;
}
.bullet-marker {
  position: absolute;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  color: ${cssColor(theme.colors.accent)};
  font-size: ${ptToPx(theme.typography.bullets * 1.45)}px;
  line-height: 0.9;
  font-weight: 400;
}
.bullet-text {
  position: absolute;
  display: block;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: break-word;
  font-size: ${ptToPx(theme.typography.bullets)}px;
  line-height: 1.36;
  color: ${cssColor(theme.colors.text)};
  letter-spacing: 0;
}
.bullet-list-fallback {
  display: grid;
  gap: 10px;
}
.bullet-list-fallback .bullet-item {
  position: static;
  display: grid;
  grid-template-columns: 5px minmax(0, 1fr);
  gap: 14px;
}
.bullet-list-fallback .bullet-marker,
.bullet-list-fallback .bullet-text {
  position: static;
}
.cards {
  position: absolute;
  overflow: hidden;
}
.card {
  position: absolute;
  overflow: hidden;
  border: 0;
  border-radius: 4px;
  background: ${cssColor(theme.colors.card)};
}
.card-icon {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: ${cssColor(theme.colors.accentSoft)};
}
.card-icon img {
  width: 56%;
  height: 56%;
  object-fit: contain;
  display: block;
  opacity: 0.8;
}
.card-icon span {
  font-size: ${ptToPx(theme.typography.cardTitle)}px;
  line-height: 1;
  color: ${cssColor(theme.colors.accent)};
}
.card h3,
.card p {
  position: absolute;
  margin: 0;
  overflow: hidden;
  overflow-wrap: break-word;
}
.card h3 {
  color: ${cssColor(theme.colors.text)};
}
.card p {
  font-size: ${ptToPx(theme.typography.cardBody)}px;
  line-height: 1.3;
  color: ${cssColor(theme.colors.muted)};
}
.card-metric {
  background: transparent;
}
.card-metric h3 {
  font-family: ${JSON.stringify(theme.fonts.body)}, ui-sans-serif, system-ui, sans-serif;
  font-size: ${ptToPx(theme.typography.metric)}px;
  line-height: 0.95;
  font-weight: 700;
  color: ${cssColor(theme.colors.text)};
}
.card-metric p {
  color: ${cssColor(theme.colors.text)};
}
.cards-fallback {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.cards-fallback .card {
  position: static;
  padding: 10px;
}
.cards-fallback .card h3,
.cards-fallback .card p {
  position: static;
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
  border: 1px solid ${cssColor(theme.colors.border)};
  border-radius: 8px;
  background: ${cssColor(theme.colors.surface)};
  color: ${cssColor(theme.colors.muted)};
  text-align: center;
  overflow: hidden;
}
.image-frame {
  margin: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.image-frame img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
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
