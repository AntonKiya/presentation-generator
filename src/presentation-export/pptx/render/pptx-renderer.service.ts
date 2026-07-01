import { Inject, Injectable } from "@nestjs/common";
import {
  getDefaultPresentationIconPath,
  getDefaultPresentationImagePath,
} from "../../../presentation-assets";
import type {
  LayoutChild,
  LayoutContainer,
} from "../../../presentation-generation/schemas/container-schema";
import type {
  ChartElement,
  Element,
} from "../../../presentation-generation/schemas/element-schema";
import type { Slide } from "../../../presentation-generation/schemas/slide-schema";
import {
  getBulletsInternalLayout,
  getCardsInternalLayout,
} from "../../../presentation-layout";
import {
  resolvePptxExportOptions,
  type PptxExportIssue,
} from "../pptx-export-contract";
import type {
  PptxLayoutBox,
  PptxLayoutNode,
  PptxSlideLayout,
} from "../layout";
import {
  PPTX_WRITER_ADAPTER,
  type PptxWriterAdapter,
  type PptxWriterChartSeries,
  type PptxWriterSlide,
  type PptxWriterTableRow,
  type PptxWriterTextOptions,
} from "../writer";
import {
  resolvePptxExportTheme,
  type PptxExportTheme,
} from "../theme";
import type {
  PptxRenderPresentationInput,
  PptxRenderResult,
} from "./pptx-render.types";

@Injectable()
export class PptxRendererService {
  constructor(
    @Inject(PPTX_WRITER_ADAPTER)
    private readonly writer: PptxWriterAdapter,
  ) {}

  renderPresentation(input: PptxRenderPresentationInput): PptxRenderResult {
    const options = resolvePptxExportOptions(input.options);
    const theme = resolvePptxExportTheme(options.themeId);
    const issues: PptxExportIssue[] = [...input.layout.issues];
    const writerPresentation = this.writer.createPresentation({
      metadata: {
        title: input.presentation.title ?? input.presentation.id,
        author: "AI Presentations",
        subject: "Generated presentation export",
      },
    });

    input.presentation.slides.forEach((slide, slideIndex) => {
      const slideLayout = input.layout.slides[slideIndex];

      if (!slideLayout) {
        issues.push({
          severity: "error",
          code: "WRITER_FAILURE",
          message: `Missing PPTX layout for slide index ${slideIndex}.`,
          slideId: slide.id,
          path: `slides[${slideIndex}]`,
        });
        return;
      }

      const writerSlide = this.writer.addSlide(writerPresentation);

      this.renderSlide({
        slide,
        slideLayout,
        writerSlide,
        issues,
        theme,
        useDebugFrames: options.includeDebug,
      });
    });

    return {
      presentation: writerPresentation,
      layout: input.layout,
      issues,
      renderedSlides: input.layout.slides.length,
    };
  }

  private renderSlide(input: {
    slide: Slide;
    slideLayout: PptxSlideLayout;
    writerSlide: PptxWriterSlide;
    issues: PptxExportIssue[];
    theme: PptxExportTheme;
    useDebugFrames: boolean;
  }): void {
    const { slide, slideLayout, writerSlide, issues, theme, useDebugFrames } = input;

    this.writer.addShape(writerSlide, "rect", {
      ...slideLayout.slideBox,
      objectName: `${slide.id}_background`,
      fill: { color: theme.colors.background },
      line: { transparency: 100, width: 0 },
    });

    this.renderContainer({
      container: slide.root_container,
      layoutNode: slideLayout.root,
      writerSlide,
      issues,
      theme,
      slideId: slide.id,
      useDebugFrames,
    });
  }

  private renderContainer(input: {
    container: LayoutContainer;
    layoutNode: PptxLayoutNode;
    writerSlide: PptxWriterSlide;
    issues: PptxExportIssue[];
    theme: PptxExportTheme;
    slideId: string;
    useDebugFrames: boolean;
  }): void {
    const {
      container,
      layoutNode,
      writerSlide,
      issues,
      theme,
      slideId,
      useDebugFrames,
    } = input;
    const children = container.children as LayoutChild[];
    const layoutChildren = layoutNode.children ?? [];

    if (useDebugFrames) {
      this.writer.addShape(writerSlide, "rect", {
        ...layoutNode.box,
        objectName: `${layoutNode.nodeId}_debug_frame`,
        fill: { transparency: 100 },
        line: { color: theme.colors.accent, transparency: 60, width: 0.5 },
      });
    }

    this.renderTitleAccentLine(container, layoutNode, writerSlide, theme);

    children.forEach((child, index) => {
      const childLayout = layoutChildren[index];

      if (!childLayout) {
        issues.push({
          severity: "error",
          code: "WRITER_FAILURE",
          message: `Missing PPTX layout node for child index ${index}.`,
          slideId,
          nodeId: isLayoutContainer(child) ? child.id : (child as Element).id,
          path: `${layoutNode.path}.children[${index}]`,
        });
        return;
      }

      if (isLayoutContainer(child)) {
        this.renderContainer({
          container: child,
          layoutNode: childLayout,
          writerSlide,
          issues,
          theme,
          slideId,
          useDebugFrames,
        });
        return;
      }

      this.safeRenderElement({
        element: child as Element,
        layoutNode: childLayout,
        writerSlide,
        issues,
        theme,
        slideId,
      });
    });
  }

  private safeRenderElement(input: {
    element: Element;
    layoutNode: PptxLayoutNode;
    writerSlide: PptxWriterSlide;
    issues: PptxExportIssue[];
    theme: PptxExportTheme;
    slideId: string;
  }): void {
    const { element, layoutNode, writerSlide, issues, theme, slideId } = input;

    try {
      this.renderElement({
        element,
        layoutNode,
        writerSlide,
        theme,
      });
    } catch (error) {
      issues.push({
        severity: "error",
        code: "WRITER_FAILURE",
        message: `Failed to render PPTX element "${element.type}": ${getErrorMessage(error)}`,
        slideId,
        nodeId: element.id,
        path: layoutNode.path,
      });
    }
  }

  private renderElement(input: {
    element: Element;
    layoutNode: PptxLayoutNode;
    writerSlide: PptxWriterSlide;
    theme: PptxExportTheme;
  }): void {
    const { element, layoutNode, writerSlide, theme } = input;
    const { box } = layoutNode;

    switch (element.type) {
      case "title":
        this.writer.addText(writerSlide, element.text, {
          ...textBox(box, element.id),
          ...baseText(theme, "title"),
          bold: true,
        });
        return;
      case "subtitle":
        this.writer.addText(writerSlide, element.text, {
          ...textBox(box, element.id),
          ...baseText(theme, "subtitle"),
          color: theme.colors.muted,
        });
        return;
      case "text":
        this.writer.addText(writerSlide, element.text, {
          ...textBox(box, element.id),
          ...baseText(theme, "body"),
        });
        return;
      case "bullets":
        this.renderBullets(element, layoutNode, writerSlide, theme);
        return;
      case "image":
        this.renderImagePlaceholder(element, box, writerSlide, theme);
        return;
      case "cards":
        this.renderCards(element, layoutNode, writerSlide, theme);
        return;
      case "table":
        this.renderTable(element, box, writerSlide, theme);
        return;
      case "chart":
        this.renderChart(element, box, writerSlide, theme);
        return;
    }
  }

  private renderTitleAccentLine(
    container: LayoutContainer,
    layoutNode: PptxLayoutNode,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    if (container.slot !== "title") {
      return;
    }

    this.writer.addShape(writerSlide, "roundRect", {
      x: layoutNode.box.x,
      y: layoutNode.box.y + layoutNode.box.h + theme.spacing.titleAccentGap,
      w: Math.min(theme.spacing.titleAccentWidth, layoutNode.box.w),
      h: theme.spacing.titleAccentHeight,
      objectName: `${layoutNode.nodeId}_title_accent`,
      fill: { color: theme.colors.accent },
      line: { transparency: 100, width: 0 },
      radius: 0.03,
    });
  }

  private renderBullets(
    element: Extract<Element, { type: "bullets" }>,
    layoutNode: PptxLayoutNode,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    const internalLayout = getBulletsInternalLayout(layoutNode);

    if (!internalLayout || element.items.length === 0) {
      return;
    }

    internalLayout.items.forEach((item) => {
      this.writer.addText(writerSlide, "→", {
        ...textBox(item.markerBox, `${element.id}_bullet_marker_${item.index + 1}`),
        fontFace: theme.fonts.body,
        fontSize: item.markerFontSize,
        color: theme.colors.accent,
        margin: 0,
        align: "center",
        valign: "top",
        fit: "shrink",
      });
      this.writer.addText(writerSlide, item.text, {
        ...textBox(item.textBox, `${element.id}_bullet_text_${item.index + 1}`),
        ...baseText(theme, "bullets"),
        fontSize: item.textFontSize,
        lineSpacingMultiple: item.textLineHeightMultiple,
        margin: 0,
      });
    });
  }

  private renderImagePlaceholder(
    element: Extract<Element, { type: "image" }>,
    box: PptxLayoutBox,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    const imagePath = getDefaultPresentationImagePath();

    if (imagePath) {
      this.writer.addImage(writerSlide, {
        ...box,
        objectName: element.id,
        path: imagePath,
        sizing: element.fit === "contain" ? "contain" : "cover",
      });
      return;
    }

    this.writer.addShape(writerSlide, "roundRect", {
      ...box,
      objectName: `${element.id}_placeholder_shape`,
      fill: { color: theme.colors.surface },
      line: { color: theme.colors.border, width: 1 },
      radius: 0.12,
    });
    this.writer.addText(
      writerSlide,
      element.alt,
      {
        ...textBox(insetBox(box, 0.12), element.id),
        ...baseText(theme, "placeholder"),
        color: theme.colors.muted,
        align: "center",
        valign: "middle",
      },
    );
  }

  private renderCards(
    element: Extract<Element, { type: "cards" }>,
    layoutNode: PptxLayoutNode,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    const internalLayout = getCardsInternalLayout(layoutNode);

    if (!internalLayout || element.items.length === 0) {
      return;
    }

    internalLayout.items.forEach((item) => {
      this.writer.addShape(writerSlide, "roundRect", {
        ...item.cardBox,
        objectName: `${element.id}_card_${item.index + 1}`,
        fill:
          item.variant === "metric"
            ? { transparency: 100 }
            : { color: theme.colors.card },
        line: { transparency: 100, width: 0 },
        radius: 0.04,
      });
      this.renderCardIcon({
        elementId: element.id,
        item,
        writerSlide,
        theme,
      });
      this.writer.addText(writerSlide, item.title, {
        ...textBox(item.titleBox, `${element.id}_card_${item.index + 1}_title`),
        ...baseText(theme, item.variant === "metric" ? "metric" : "cardTitle"),
        fontSize: item.titleFontSize,
        lineSpacingMultiple: item.titleLineHeightMultiple,
        bold: true,
        margin: 0,
        color: item.variant === "metric" ? theme.colors.text : theme.colors.text,
        align: item.variant === "metric" ? "center" : "left",
      });
      this.writer.addText(writerSlide, item.text, {
        ...textBox(item.bodyBox, `${element.id}_card_${item.index + 1}_body`),
        ...baseText(theme, "cardBody"),
        fontSize: item.bodyFontSize,
        lineSpacingMultiple: item.bodyLineHeightMultiple,
        color: item.variant === "metric" ? theme.colors.text : theme.colors.muted,
        margin: 0,
        align: item.variant === "metric" ? "center" : "left",
      });
    });
  }

  private renderCardIcon(input: {
    elementId: string;
    item: NonNullable<ReturnType<typeof getCardsInternalLayout>>["items"][number];
    writerSlide: PptxWriterSlide;
    theme: PptxExportTheme;
  }): void {
    const { elementId, item, writerSlide, theme } = input;

    if (!item.iconBox) {
      return;
    }

    this.writer.addShape(writerSlide, "roundRect", {
      ...item.iconBox,
      objectName: `${elementId}_card_${item.index + 1}_icon_background`,
      fill: { color: theme.colors.accentSoft },
      line: { transparency: 100, width: 0 },
      radius: 0.2,
    });

    const iconPath = getDefaultPresentationIconPath();

    if (iconPath) {
      const iconInset = Math.min(item.iconBox.w, item.iconBox.h) * 0.22;

      this.writer.addImage(writerSlide, {
        ...insetBox(item.iconBox, iconInset),
        objectName: `${elementId}_card_${item.index + 1}_icon`,
        path: iconPath,
        sizing: "contain",
      });
      return;
    }

    this.writer.addText(writerSlide, "✦", {
      ...textBox(item.iconBox, `${elementId}_card_${item.index + 1}_icon`),
      fontFace: theme.fonts.body,
      fontSize: theme.typography.cardTitle,
      color: theme.colors.accent,
      align: "center",
      valign: "middle",
      margin: 0,
    });
  }

  private renderTable(
    element: Extract<Element, { type: "table" }>,
    box: PptxLayoutBox,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    const rows: PptxWriterTableRow[] = [
      element.columns.map((column) => ({
        text: column,
        options: {
          ...baseText(theme, "table"),
          bold: true,
          color: theme.colors.text,
          fill: { color: theme.colors.surface },
          border: { color: theme.colors.border, width: 0.5 },
        },
      })),
      ...element.rows.map((row) =>
        row.map((cell) => ({
          text: cell,
          options: {
            ...baseText(theme, "table"),
            border: { color: theme.colors.border, width: 0.5 },
          },
        })),
      ),
    ];
    const rowCount = rows.length;

    this.writer.addTable(writerSlide, rows, {
      ...box,
      objectName: element.id,
      ...baseText(theme, "table"),
      border: { color: theme.colors.border, width: 0.5 },
      colW: element.columns.map(() => box.w / element.columns.length),
      rowH: Array.from({ length: rowCount }, () => box.h / rowCount),
      margin: theme.spacing.tableCellMargin,
    });
  }

  private renderChart(
    element: ChartElement,
    box: PptxLayoutBox,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    this.writer.addShape(writerSlide, "roundRect", {
      ...box,
      objectName: `${element.id}_chart_background`,
      fill: { color: theme.colors.surface },
      line: { color: theme.colors.border, width: 0.8 },
      radius: 0.08,
    });
    this.writer.addChart(writerSlide, element.chart_type, toChartSeries(element), {
      ...insetBox(box, 0.1),
      objectName: element.id,
      showLegend: true,
      showValue: element.chart_type === "pie",
      colors: [...theme.colors.chart],
      fontFace: theme.fonts.body,
      fontSize: theme.typography.chart,
    });
  }
}

function baseText(
  theme: PptxExportTheme,
  variant: keyof PptxExportTheme["typography"],
): Omit<PptxWriterTextOptions, "x" | "y" | "w" | "h" | "objectName"> {
  return {
    fontFace: variant === "title" ? theme.fonts.heading : theme.fonts.body,
    fontSize: theme.typography[variant],
    color: theme.colors.text,
    fit: "shrink",
    margin: theme.spacing.textMargin,
    valign: "top",
  };
}

function textBox(box: PptxLayoutBox, objectName: string): PptxWriterTextOptions {
  return {
    ...box,
    objectName,
  };
}

function toChartSeries(element: ChartElement): PptxWriterChartSeries[] {
  if (element.chart_type === "pie") {
    return [
      {
        name: element.unit ?? "Value",
        labels: element.slices.map((slice) => slice.label),
        values: element.slices.map((slice) => slice.value),
      },
    ];
  }

  return element.series.map((series) => ({
    name: series.label,
    labels: element.labels,
    values: series.values,
  }));
}

function insetBox(box: PptxLayoutBox, inset: number): PptxLayoutBox {
  return {
    x: box.x + inset,
    y: box.y + inset,
    w: Math.max(0, box.w - inset * 2),
    h: Math.max(0, box.h - inset * 2),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isLayoutContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}
