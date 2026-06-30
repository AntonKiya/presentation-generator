import { Inject, Injectable } from "@nestjs/common";
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
    const issues = [...input.layout.issues];
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
        box: layoutNode.box,
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
    box: PptxLayoutBox;
    writerSlide: PptxWriterSlide;
    theme: PptxExportTheme;
  }): void {
    const { element, box, writerSlide, theme } = input;

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
        this.writer.addText(writerSlide, element.items.join("\n"), {
          ...textBox(box, element.id),
          ...baseText(theme, "bullets"),
          bullet: true,
          lineSpacingMultiple: 1.1,
        });
        return;
      case "image":
        this.renderImagePlaceholder(element, box, writerSlide, theme);
        return;
      case "cards":
        this.renderCards(element, box, writerSlide, theme);
        return;
      case "table":
        this.renderTable(element, box, writerSlide, theme);
        return;
      case "chart":
        this.renderChart(element, box, writerSlide, theme);
        return;
    }
  }

  private renderImagePlaceholder(
    element: Extract<Element, { type: "image" }>,
    box: PptxLayoutBox,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    this.writer.addShape(writerSlide, "roundRect", {
      ...box,
      objectName: `${element.id}_placeholder_shape`,
      fill: { color: theme.colors.surface },
      line: { color: theme.colors.border, width: 1, dash: "dash" },
      radius: 0.12,
    });
    this.writer.addText(
      writerSlide,
      `${element.alt}\n${element.asset_id}`,
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
    box: PptxLayoutBox,
    writerSlide: PptxWriterSlide,
    theme: PptxExportTheme,
  ): void {
    const columns = resolveCardsColumns(element.items.length);
    const rows = Math.ceil(element.items.length / columns);
    const gap = theme.spacing.cardGap;
    const cardWidth = Math.max(0, (box.w - gap * (columns - 1)) / columns);
    const cardHeight = Math.max(0, (box.h - gap * (rows - 1)) / rows);

    element.items.forEach((item, index) => {
      const columnIndex = index % columns;
      const rowIndex = Math.floor(index / columns);
      const cardBox = {
        x: box.x + columnIndex * (cardWidth + gap),
        y: box.y + rowIndex * (cardHeight + gap),
        w: cardWidth,
        h: cardHeight,
      };
      const innerBox = insetBox(cardBox, theme.spacing.cardPadding);

      this.writer.addShape(writerSlide, "roundRect", {
        ...cardBox,
        objectName: `${element.id}_card_${index + 1}`,
        fill: { color: theme.colors.card },
        line: { color: theme.colors.border, width: 0.8 },
        radius: 0.08,
      });
      this.writer.addText(writerSlide, item.title, {
        ...textBox(
          {
            ...innerBox,
            h: Math.min(0.35, innerBox.h),
          },
          `${element.id}_card_${index + 1}_title`,
        ),
        ...baseText(theme, "cardTitle"),
        bold: true,
      });
      this.writer.addText(writerSlide, item.text, {
        ...textBox(
          {
            x: innerBox.x,
            y: innerBox.y + Math.min(0.4, innerBox.h),
            w: innerBox.w,
            h: Math.max(0.1, innerBox.h - 0.4),
          },
          `${element.id}_card_${index + 1}_body`,
        ),
        ...baseText(theme, "cardBody"),
        color: theme.colors.muted,
      });
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

function resolveCardsColumns(itemsCount: number): number {
  if (itemsCount <= 2) {
    return Math.max(1, itemsCount);
  }

  if (itemsCount <= 4) {
    return 2;
  }

  return 3;
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
