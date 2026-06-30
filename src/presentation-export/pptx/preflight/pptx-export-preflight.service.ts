import { Injectable } from "@nestjs/common";
import type {
  LayoutChild,
  LayoutContainer,
} from "../../../presentation-generation/schemas/container-schema";
import type {
  ChartElement,
  Element,
} from "../../../presentation-generation/schemas/element-schema";
import type { Presentation } from "../../../presentation-generation/schemas/presentation-schema";
import type { Slide } from "../../../presentation-generation/schemas/slide-schema";
import {
  PPTX_EXPORT_SUPPORTED_CHART_TYPES,
  PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES,
  PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES,
  resolvePptxExportOptions,
  type PptxExportIssue,
  type PptxExportOptions,
  type PptxExportPreflightResult,
} from "../pptx-export-contract";
import { PPTX_PREFLIGHT_LIMITS } from "./pptx-export-preflight.constants";

@Injectable()
export class PptxExportPreflightService {
  // Preflight checks PPTX exporter capabilities, not the DSL shape itself.
  // PresentationSchema and generation validators remain the source of truth for DSL validity.
  check(
    presentation: Presentation,
    options?: Partial<PptxExportOptions>,
  ): PptxExportPreflightResult {
    const resolvedOptions = resolvePptxExportOptions(options);
    const issues: PptxExportIssue[] = [];

    presentation.slides.forEach((slide, slideIndex) => {
      this.checkContainer({
        container: slide.root_container,
        slide,
        path: `slides[${slideIndex}].root_container`,
        depth: 1,
        issues,
        options: resolvedOptions,
      });
    });

    return {
      status: getStatus(issues),
      issues,
    };
  }

  private checkContainer(input: {
    container: LayoutContainer;
    slide: Slide;
    path: string;
    depth: number;
    issues: PptxExportIssue[];
    options: PptxExportOptions;
  }): void {
    const { container, slide, path, depth, issues, options } = input;

    if (!isSupportedContainerType(container.type)) {
      issues.push(
        createIssue({
          severity: "error",
          code: "UNSUPPORTED_CONTAINER_TYPE",
          message: `Container type "${String(container.type)}" is not supported by PPTX export.`,
          slideId: slide.id,
          nodeId: container.id,
          path: `${path}.type`,
        }),
      );
      return;
    }

    if (depth > PPTX_PREFLIGHT_LIMITS.maxContainerDepth) {
      issues.push(
        createIssue({
          severity: "warning",
          code: "CONTAINER_TOO_DEEPLY_NESTED",
          message: `Container depth ${depth} may be too deep for stable PPTX layout.`,
          slideId: slide.id,
          nodeId: container.id,
          path,
        }),
      );
    }

    if (container.type === "grid" && container.columns === "auto") {
      issues.push(
        createIssue({
          severity: "warning",
          code: "GRID_AUTO_RESOLVED_APPROXIMATELY",
          message:
            "Grid columns='auto' will be resolved by the shared layout engine using deterministic heuristics.",
          slideId: slide.id,
          nodeId: container.id,
          path: `${path}.columns`,
        }),
      );
    }

    const children = container.children as LayoutChild[];

    children.forEach((child, index) => {
      const childPath = `${path}.children[${index}]`;

      if (isLayoutContainer(child)) {
        this.checkContainer({
          container: child,
          slide,
          path: childPath,
          depth: depth + 1,
          issues,
          options,
        });
        return;
      }

      this.checkElement({
        element: child,
        slide,
        path: childPath,
        issues,
        options,
      });
    });
  }

  private checkElement(input: {
    element: Element;
    slide: Slide;
    path: string;
    issues: PptxExportIssue[];
    options: PptxExportOptions;
  }): void {
    const { element, slide, path, issues, options } = input;

    if (!isSupportedElementType(element.type)) {
      issues.push(
        createIssue({
          severity: "error",
          code: "UNSUPPORTED_ELEMENT_TYPE",
          message: `Element type "${String(element.type)}" is not supported by PPTX export.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.type`,
        }),
      );
      return;
    }

    switch (element.type) {
      case "title":
        checkTextLength({
          text: element.text,
          maxChars: PPTX_PREFLIGHT_LIMITS.titleMaxChars,
          code: "TEXT_MAY_OVERFLOW",
          label: "Title",
          slide,
          nodeId: element.id,
          path: `${path}.text`,
          issues,
        });
        return;
      case "subtitle":
        checkTextLength({
          text: element.text,
          maxChars: PPTX_PREFLIGHT_LIMITS.subtitleMaxChars,
          code: "TEXT_MAY_OVERFLOW",
          label: "Subtitle",
          slide,
          nodeId: element.id,
          path: `${path}.text`,
          issues,
        });
        return;
      case "text":
        checkTextLength({
          text: element.text,
          maxChars: PPTX_PREFLIGHT_LIMITS.textMaxChars,
          code: "TEXT_MAY_OVERFLOW",
          label: "Text",
          slide,
          nodeId: element.id,
          path: `${path}.text`,
          issues,
        });
        return;
      case "bullets":
        this.checkBullets(element, slide, path, issues);
        return;
      case "image":
        issues.push(
          createIssue({
            severity: "warning",
            code:
              options.imageMode === "embed"
                ? "IMAGE_ASSET_MISSING"
                : "IMAGE_PLACEHOLDER_USED",
            message:
              options.imageMode === "embed"
                ? "Image embedding is not implemented in the current PPTX MVP; exporter should fall back to an editable placeholder."
                : "Image will be exported as an editable placeholder in the current PPTX MVP.",
            slideId: slide.id,
            nodeId: element.id,
            path,
          }),
        );
        return;
      case "cards":
        this.checkCards(element, slide, path, issues);
        return;
      case "table":
        this.checkTable(element, slide, path, issues);
        return;
      case "chart":
        this.checkChart(element, slide, path, issues);
        return;
    }
  }

  private checkBullets(
    element: Extract<Element, { type: "bullets" }>,
    slide: Slide,
    path: string,
    issues: PptxExportIssue[],
  ): void {
    if (element.items.length > PPTX_PREFLIGHT_LIMITS.bulletMaxItems) {
      issues.push(
        createIssue({
          severity: "warning",
          code: "BULLETS_MAY_OVERFLOW",
          message: `Bullets contain ${element.items.length} items; PPTX export may need font shrink or tighter spacing.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.items`,
        }),
      );
    }

    element.items.forEach((item, index) => {
      if (item.length <= PPTX_PREFLIGHT_LIMITS.bulletMaxChars) {
        return;
      }

      issues.push(
        createIssue({
          severity: "warning",
          code: "BULLETS_MAY_OVERFLOW",
          message: `Bullet item ${index + 1} is long and may overflow in PPTX export.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.items[${index}]`,
        }),
      );
    });
  }

  private checkCards(
    element: Extract<Element, { type: "cards" }>,
    slide: Slide,
    path: string,
    issues: PptxExportIssue[],
  ): void {
    if (element.items.length > PPTX_PREFLIGHT_LIMITS.cardsMaxItems) {
      issues.push(
        createIssue({
          severity: "warning",
          code: "CARDS_MAY_OVERFLOW",
          message: `Cards contain ${element.items.length} items; PPTX grid/cards layout may be dense.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.items`,
        }),
      );
    }

    element.items.forEach((item, index) => {
      if (
        item.title.length <= PPTX_PREFLIGHT_LIMITS.cardTitleMaxChars &&
        item.text.length <= PPTX_PREFLIGHT_LIMITS.cardTextMaxChars
      ) {
        return;
      }

      issues.push(
        createIssue({
          severity: "warning",
          code: "CARDS_MAY_OVERFLOW",
          message: `Card ${index + 1} has long text and may require shrink in PPTX export.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.items[${index}]`,
        }),
      );
    });
  }

  private checkTable(
    element: Extract<Element, { type: "table" }>,
    slide: Slide,
    path: string,
    issues: PptxExportIssue[],
  ): void {
    if (element.rows.length > PPTX_PREFLIGHT_LIMITS.tableMaxRows) {
      issues.push(
        createIssue({
          severity: "warning",
          code: "TABLE_TOO_MANY_ROWS",
          message: `Table has ${element.rows.length} rows; PPTX export may need smaller font or tighter row height.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.rows`,
        }),
      );
    }

    if (element.columns.length > PPTX_PREFLIGHT_LIMITS.tableMaxColumns) {
      issues.push(
        createIssue({
          severity: "warning",
          code: "TABLE_TOO_MANY_COLUMNS",
          message: `Table has ${element.columns.length} columns; PPTX export may be too dense.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.columns`,
        }),
      );
    }
  }

  private checkChart(
    element: ChartElement,
    slide: Slide,
    path: string,
    issues: PptxExportIssue[],
  ): void {
    if (!isSupportedChartType(element.chart_type)) {
      issues.push(
        createIssue({
          severity: "error",
          code: "UNSUPPORTED_CHART_TYPE",
          message: `Chart type "${String(element.chart_type)}" is not supported by PPTX export.`,
          slideId: slide.id,
          nodeId: element.id,
          path: `${path}.chart_type`,
        }),
      );
      return;
    }

    const labelsCount =
      element.chart_type === "pie" ? element.slices.length : element.labels.length;

    if (labelsCount <= PPTX_PREFLIGHT_LIMITS.chartMaxLabels) {
      return;
    }

    issues.push(
      createIssue({
        severity: "warning",
        code: "CHART_TOO_MANY_LABELS",
        message: `Chart has ${labelsCount} labels/slices; PPTX export may have crowded labels.`,
        slideId: slide.id,
        nodeId: element.id,
        path:
          element.chart_type === "pie" ? `${path}.slices` : `${path}.labels`,
      }),
    );
  }
}

function checkTextLength(input: {
  text: string;
  maxChars: number;
  code: "TEXT_MAY_OVERFLOW";
  label: string;
  slide: Slide;
  nodeId: string;
  path: string;
  issues: PptxExportIssue[];
}): void {
  if (input.text.length <= input.maxChars) {
    return;
  }

  input.issues.push(
    createIssue({
      severity: "warning",
      code: input.code,
      message: `${input.label} has ${input.text.length} characters; PPTX export may need font shrink.`,
      slideId: input.slide.id,
      nodeId: input.nodeId,
      path: input.path,
    }),
  );
}

function createIssue(issue: PptxExportIssue): PptxExportIssue {
  return issue;
}

function getStatus(issues: PptxExportIssue[]): PptxExportPreflightResult["status"] {
  if (issues.some((issue) => issue.severity === "error")) {
    return "blocked";
  }

  if (issues.length > 0) {
    return "exportable_with_warnings";
  }

  return "ok";
}

function isLayoutContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}

function isSupportedContainerType(
  type: string,
): type is (typeof PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES)[number] {
  return PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES.includes(
    type as (typeof PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES)[number],
  );
}

function isSupportedElementType(
  type: string,
): type is (typeof PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES)[number] {
  return PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES.includes(
    type as (typeof PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES)[number],
  );
}

function isSupportedChartType(
  type: string,
): type is (typeof PPTX_EXPORT_SUPPORTED_CHART_TYPES)[number] {
  return PPTX_EXPORT_SUPPORTED_CHART_TYPES.includes(
    type as (typeof PPTX_EXPORT_SUPPORTED_CHART_TYPES)[number],
  );
}
