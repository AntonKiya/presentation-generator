import {
  ContainerTypeSchema,
  type ContainerType,
} from "../../presentation-generation/schemas/container-schema";
import {
  AVAILABLE_ELEMENT_TYPES,
} from "../../presentation-generation/schemas/generation-schema";
import type {
  ChartType,
  ElementType,
} from "../../presentation-generation/schemas/element-schema";
import {
  getPresentationLayoutSlideSize,
  PRESENTATION_LAYOUT_SLIDE_SIZES,
  type PresentationLayoutSlideSize,
  type PresentationLayoutSlideSizeDimensions,
} from "../../presentation-layout";

export const PPTX_EXPORT_CONTRACT_VERSION = "pptx-export-contract-v1";

export const PPTX_EXPORT_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES =
  ContainerTypeSchema.options;

export const PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES = AVAILABLE_ELEMENT_TYPES;

export const PPTX_EXPORT_SUPPORTED_CHART_TYPES = [
  "bar",
  "line",
  "pie",
] as const satisfies readonly ChartType[];

export type PptxExportSlideSize = PresentationLayoutSlideSize;

export type PptxExportSlideSizeDimensions =
  PresentationLayoutSlideSizeDimensions;

export const PPTX_EXPORT_SLIDE_SIZES = PRESENTATION_LAYOUT_SLIDE_SIZES;

export type PptxExportThemeId = "default";

export type PptxExportImageMode = "placeholder" | "embed";

export type PptxExportOverflowMode = "shrink" | "warn" | "truncate";

export type PptxExportObjectMode = "editable";

export type PptxExportOptions = {
  slideSize: PptxExportSlideSize;
  themeId: PptxExportThemeId;
  imageMode: PptxExportImageMode;
  overflowMode: PptxExportOverflowMode;
  objectMode: PptxExportObjectMode;
  includeDebug: boolean;
};

export const PPTX_EXPORT_DEFAULT_OPTIONS = {
  slideSize: "wide-16-9",
  themeId: "default",
  imageMode: "placeholder",
  overflowMode: "shrink",
  objectMode: "editable",
  includeDebug: false,
} as const satisfies PptxExportOptions;

export function resolvePptxExportOptions(
  options: Partial<PptxExportOptions> = {},
): PptxExportOptions {
  return {
    ...PPTX_EXPORT_DEFAULT_OPTIONS,
    ...options,
  };
}

export function getPptxExportSlideSize(
  slideSize: PptxExportSlideSize,
): PptxExportSlideSizeDimensions {
  return getPresentationLayoutSlideSize(slideSize);
}

export type PptxExportStatus =
  | "ok"
  | "exportable_with_warnings"
  | "blocked";

export type PptxExportIssueSeverity = "warning" | "error";

export type PptxExportIssueCode =
  | "UNSUPPORTED_CONTAINER_TYPE"
  | "UNSUPPORTED_ELEMENT_TYPE"
  | "UNSUPPORTED_CHART_TYPE"
  | "TEXT_MAY_OVERFLOW"
  | "BULLETS_MAY_OVERFLOW"
  | "CARDS_MAY_OVERFLOW"
  | "TABLE_TOO_MANY_ROWS"
  | "TABLE_TOO_MANY_COLUMNS"
  | "CHART_TOO_MANY_LABELS"
  | "IMAGE_PLACEHOLDER_USED"
  | "IMAGE_ASSET_MISSING"
  | "GRID_AUTO_RESOLVED_APPROXIMATELY"
  | "BOX_TOO_SMALL"
  | "CONTAINER_TOO_DEEPLY_NESTED"
  | "WRITER_FAILURE";

export type PptxExportIssue = {
  severity: PptxExportIssueSeverity;
  code: PptxExportIssueCode;
  message: string;
  slideId?: string;
  nodeId?: string;
  path?: string;
};

export type PptxExportPreflightResult = {
  status: PptxExportStatus;
  issues: PptxExportIssue[];
};

export type PptxExportResult = {
  buffer: Buffer;
  mimeType: typeof PPTX_EXPORT_MIME_TYPE;
  fileName: string;
  status: PptxExportStatus;
  issues: PptxExportIssue[];
};

export type PptxExportElementRenderingMode =
  | "native_text"
  | "editable_shapes_and_text"
  | "native_table"
  | "native_chart"
  | "placeholder_or_native_image";

export type PptxExportElementSupport = {
  rendering: PptxExportElementRenderingMode;
  editable: boolean;
  mvpBehavior: string;
};

export const PPTX_EXPORT_ELEMENT_SUPPORT = {
  title: {
    rendering: "native_text",
    editable: true,
    mvpBehavior: "Render as editable PowerPoint text.",
  },
  subtitle: {
    rendering: "native_text",
    editable: true,
    mvpBehavior: "Render as editable PowerPoint text.",
  },
  text: {
    rendering: "native_text",
    editable: true,
    mvpBehavior: "Render as editable PowerPoint text.",
  },
  bullets: {
    rendering: "editable_shapes_and_text",
    editable: true,
    mvpBehavior: "Render as editable arrow marker and text boxes.",
  },
  image: {
    rendering: "placeholder_or_native_image",
    editable: true,
    mvpBehavior:
      "Use editable placeholder by default; embed real asset only when imageMode=embed is implemented.",
  },
  cards: {
    rendering: "editable_shapes_and_text",
    editable: true,
    mvpBehavior: "Render cards as editable shapes and text boxes.",
  },
  table: {
    rendering: "native_table",
    editable: true,
    mvpBehavior: "Render as native editable PowerPoint table.",
  },
  chart: {
    rendering: "native_chart",
    editable: true,
    mvpBehavior: "Render bar, line, and pie charts as native PowerPoint charts.",
  },
} as const satisfies Record<ElementType, PptxExportElementSupport>;

export type PptxExportContainerLayoutMode =
  | "vertical_stack"
  | "horizontal_row"
  | "deterministic_grid";

export type PptxExportContainerSupport = {
  layout: PptxExportContainerLayoutMode;
  mvpBehavior: string;
};

export const PPTX_EXPORT_CONTAINER_SUPPORT = {
  stack: {
    layout: "vertical_stack",
    mvpBehavior: "Lay children out vertically inside an absolute box.",
  },
  row: {
    layout: "horizontal_row",
    mvpBehavior:
      "Lay children out horizontally; child width is a 0..1 fraction when provided.",
  },
  grid: {
    layout: "deterministic_grid",
    mvpBehavior:
      "Lay children out in fixed columns; columns='auto' is resolved deterministically.",
  },
} as const satisfies Record<ContainerType, PptxExportContainerSupport>;

export const PPTX_EXPORT_CONTRACT = {
  version: PPTX_EXPORT_CONTRACT_VERSION,
  sourceFormat: "presentation_json_dsl",
  targetFormat: "pptx",
  inputRequiresValidPresentation: true,
  requiresTemplateId: false,
  usesHtmlPreview: false,
  outputObjectMode: "editable",
  pixelPerfectParity: false,
  defaultOptions: PPTX_EXPORT_DEFAULT_OPTIONS,
  slideSizes: PPTX_EXPORT_SLIDE_SIZES,
  supportedContainers: PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES,
  supportedElements: PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES,
  supportedCharts: PPTX_EXPORT_SUPPORTED_CHART_TYPES,
} as const;
