import { PPTX_EXPORT_SLIDE_SIZES } from "../pptx-export-contract";

export type PptxWriterLayout = {
  name: string;
  width: number;
  height: number;
};

export type PptxWriterMetadata = {
  title?: string;
  author?: string;
  company?: string;
  subject?: string;
};

export type PptxWriterCreateOptions = {
  layout?: PptxWriterLayout;
  metadata?: PptxWriterMetadata;
};

export type PptxWriterWriteOptions = {
  compression?: boolean;
};

export type PptxWriterBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PptxWriterTextAlign = "left" | "center" | "right" | "justify";

export type PptxWriterVerticalAlign = "top" | "middle" | "bottom";

export type PptxWriterTextFit = "none" | "shrink" | "resize";

export type PptxWriterFill = {
  color?: string;
  transparency?: number;
};

export type PptxWriterLine = {
  color?: string;
  transparency?: number;
  width?: number;
  dash?: "solid" | "dash" | "dashDot";
};

export type PptxWriterTextStyle = {
  fontFace?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: PptxWriterTextAlign;
  valign?: PptxWriterVerticalAlign;
  fit?: PptxWriterTextFit;
  margin?: number | [number, number, number, number];
  bullet?: boolean;
  breakLine?: boolean;
  lineSpacingMultiple?: number;
};

export type PptxWriterTextRun = {
  text: string;
  options?: PptxWriterTextStyle;
};

export type PptxWriterTextOptions = PptxWriterBox &
  PptxWriterTextStyle & {
    objectName?: string;
    fill?: PptxWriterFill;
    line?: PptxWriterLine;
  };

export type PptxWriterShapeType = "rect" | "roundRect" | "line";

export type PptxWriterShapeOptions = PptxWriterBox & {
  objectName?: string;
  fill?: PptxWriterFill;
  line?: PptxWriterLine;
  radius?: number;
};

export type PptxWriterTableCell = {
  text: string;
  options?: PptxWriterTextStyle & {
    fill?: PptxWriterFill;
    border?: PptxWriterLine;
  };
};

export type PptxWriterTableRow = PptxWriterTableCell[];

export type PptxWriterTableOptions = PptxWriterBox &
  PptxWriterTextStyle & {
    objectName?: string;
    border?: PptxWriterLine;
    colW?: number[];
    rowH?: number[];
    margin?: number | [number, number, number, number];
  };

export type PptxWriterChartType = "bar" | "line" | "pie";

export type PptxWriterChartSeries = {
  name: string;
  labels: string[];
  values: number[];
};

export type PptxWriterChartOptions = PptxWriterBox & {
  objectName?: string;
  title?: string;
  showLegend?: boolean;
  showValue?: boolean;
  colors?: string[];
  fontFace?: string;
  fontSize?: number;
};

export type PptxWriterPresentation = {
  readonly kind: "pptx_writer_presentation";
  readonly id: string;
};

export type PptxWriterSlide = {
  readonly kind: "pptx_writer_slide";
  readonly id: string;
};

const WIDE_16_9_SIZE = PPTX_EXPORT_SLIDE_SIZES["wide-16-9"];

export const PPTX_WRITER_WIDE_LAYOUT = {
  name: "AI_WIDE_16_9",
  width: WIDE_16_9_SIZE.width,
  height: WIDE_16_9_SIZE.height,
} as const satisfies PptxWriterLayout;
