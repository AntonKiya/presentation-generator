import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import PptxGenJS from "pptxgenjs";
import type { PptxWriterAdapter } from "./pptx-writer.adapter";
import {
  PPTX_WRITER_WIDE_LAYOUT,
  type PptxWriterChartOptions,
  type PptxWriterChartSeries,
  type PptxWriterChartType,
  type PptxWriterCreateOptions,
  type PptxWriterImageOptions,
  type PptxWriterPresentation,
  type PptxWriterShapeOptions,
  type PptxWriterShapeType,
  type PptxWriterSlide,
  type PptxWriterTableCell,
  type PptxWriterTableOptions,
  type PptxWriterTableRow,
  type PptxWriterTextOptions,
  type PptxWriterTextRun,
  type PptxWriterTextStyle,
  type PptxWriterWriteOptions,
} from "./pptx-writer.types";

type NativePresentation = PptxGenJS;
type NativeSlide = ReturnType<NativePresentation["addSlide"]>;

const presentations = new WeakMap<PptxWriterPresentation, NativePresentation>();
const slides = new WeakMap<PptxWriterSlide, NativeSlide>();

@Injectable()
export class PptxGenJsAdapter implements PptxWriterAdapter {
  createPresentation(
    options: PptxWriterCreateOptions = {},
  ): PptxWriterPresentation {
    const pptx = new PptxGenJS();
    const layout = options.layout ?? PPTX_WRITER_WIDE_LAYOUT;

    pptx.defineLayout(layout);
    pptx.layout = layout.name;
    applyMetadata(pptx, options.metadata);

    const handle = createPresentationHandle();
    presentations.set(handle, pptx);

    return handle;
  }

  addSlide(presentation: PptxWriterPresentation): PptxWriterSlide {
    const pptx = getNativePresentation(presentation);
    const slide = pptx.addSlide();
    const handle = createSlideHandle();

    slides.set(handle, slide);

    return handle;
  }

  addText(
    slide: PptxWriterSlide,
    text: string | PptxWriterTextRun[],
    options: PptxWriterTextOptions,
  ): void {
    getNativeSlide(slide).addText(toNativeText(text), toNativeTextOptions(options));
  }

  addShape(
    slide: PptxWriterSlide,
    shape: PptxWriterShapeType,
    options: PptxWriterShapeOptions,
  ): void {
    getNativeSlide(slide).addShape(shape as PptxGenJS.SHAPE_NAME, {
      ...toNativePosition(options),
      objectName: options.objectName,
      fill: toNativeFill(options.fill),
      line: toNativeLine(options.line),
      rectRadius: options.radius,
    });
  }

  addImage(slide: PptxWriterSlide, options: PptxWriterImageOptions): void {
    getNativeSlide(slide).addImage({
      ...toNativePosition(options),
      objectName: options.objectName,
      path: options.path,
      transparency: options.transparency,
      sizing: options.sizing
        ? {
            type: options.sizing,
            w: options.w,
            h: options.h,
          }
        : undefined,
    });
  }

  addTable(
    slide: PptxWriterSlide,
    rows: PptxWriterTableRow[],
    options: PptxWriterTableOptions,
  ): void {
    getNativeSlide(slide).addTable(rows.map(toNativeTableRow), {
      ...toNativeTextOptions(options),
      border: toNativeLine(options.border),
      colW: options.colW,
      rowH: options.rowH,
      margin: options.margin,
    });
  }

  addChart(
    slide: PptxWriterSlide,
    chartType: PptxWriterChartType,
    series: PptxWriterChartSeries[],
    options: PptxWriterChartOptions,
  ): void {
    getNativeSlide(slide).addChart(chartType as PptxGenJS.CHART_NAME, series, {
      ...toNativePosition(options),
      objectName: options.objectName,
      title: options.title,
      showLegend: options.showLegend,
      showValue: options.showValue,
      chartColors: options.colors,
      valAxisLabelFontFace: options.fontFace,
      catAxisLabelFontFace: options.fontFace,
      valAxisLabelFontSize: options.fontSize,
      catAxisLabelFontSize: options.fontSize,
    });
  }

  async writeBuffer(
    presentation: PptxWriterPresentation,
    options: PptxWriterWriteOptions = {},
  ): Promise<Buffer> {
    const pptx = getNativePresentation(presentation);
    const output = await pptx.write({
      outputType: "nodebuffer",
      compression: options.compression,
    });

    return toBuffer(output);
  }
}

function createPresentationHandle(): PptxWriterPresentation {
  return {
    kind: "pptx_writer_presentation",
    id: randomUUID(),
  };
}

function createSlideHandle(): PptxWriterSlide {
  return {
    kind: "pptx_writer_slide",
    id: randomUUID(),
  };
}

function getNativePresentation(
  presentation: PptxWriterPresentation,
): NativePresentation {
  const pptx = presentations.get(presentation);

  if (!pptx) {
    throw new Error("Unknown PPTX writer presentation handle");
  }

  return pptx;
}

function getNativeSlide(slide: PptxWriterSlide): NativeSlide {
  const nativeSlide = slides.get(slide);

  if (!nativeSlide) {
    throw new Error("Unknown PPTX writer slide handle");
  }

  return nativeSlide;
}

function applyMetadata(
  pptx: NativePresentation,
  metadata: PptxWriterCreateOptions["metadata"],
): void {
  if (!metadata) {
    return;
  }

  if (metadata.title) {
    pptx.title = metadata.title;
  }

  if (metadata.author) {
    pptx.author = metadata.author;
  }

  if (metadata.company) {
    pptx.company = metadata.company;
  }

  if (metadata.subject) {
    pptx.subject = metadata.subject;
  }
}

function toNativeText(
  text: string | PptxWriterTextRun[],
): string | PptxGenJS.TextProps[] {
  if (typeof text === "string") {
    return text;
  }

  return text.map((run) => ({
    text: run.text,
    options: run.options ? toNativeTextOptions(run.options) : undefined,
  }));
}

function toNativeTextOptions(
  options: PptxWriterTextOptions | PptxWriterTextStyle,
): PptxGenJS.TextPropsOptions {
  return {
    ...("x" in options ? toNativePosition(options) : {}),
    objectName: "objectName" in options ? options.objectName : undefined,
    fontFace: options.fontFace,
    fontSize: options.fontSize,
    color: options.color,
    bold: options.bold,
    italic: options.italic,
    align: options.align,
    valign: options.valign,
    fit: options.fit,
    margin: options.margin,
    bullet: options.bullet,
    breakLine: options.breakLine,
    lineSpacingMultiple: options.lineSpacingMultiple,
    fill: "fill" in options ? toNativeFill(options.fill) : undefined,
    line: "line" in options ? toNativeLine(options.line) : undefined,
    isTextBox: true,
  };
}

function toNativePosition(options: {
  x: number;
  y: number;
  w: number;
  h: number;
}): PptxGenJS.PositionProps {
  return {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
  };
}

function toNativeFill(
  fill: PptxWriterShapeOptions["fill"],
): PptxGenJS.ShapeFillProps | undefined {
  if (!fill) {
    return undefined;
  }

  return {
    color: fill.color,
    transparency: fill.transparency,
  };
}

function toNativeLine(
  line: PptxWriterShapeOptions["line"],
): PptxGenJS.ShapeLineProps | undefined {
  if (!line) {
    return undefined;
  }

  return {
    color: line.color,
    transparency: line.transparency,
    width: line.width,
    dashType: line.dash,
  };
}

function toNativeTableRow(row: PptxWriterTableRow): PptxGenJS.TableRow {
  return row.map(toNativeTableCell);
}

function toNativeTableCell(cell: PptxWriterTableCell): PptxGenJS.TableCell {
  return {
    text: cell.text,
    options: cell.options
      ? {
          ...toNativeTextOptions(cell.options),
          fill: toNativeFill(cell.options.fill),
          border: toNativeLine(cell.options.border),
        }
      : undefined,
  };
}

async function toBuffer(
  output: string | ArrayBuffer | Blob | Uint8Array,
): Promise<Buffer> {
  if (Buffer.isBuffer(output)) {
    return output;
  }

  if (output instanceof ArrayBuffer) {
    return Buffer.from(output);
  }

  if (output instanceof Uint8Array) {
    return Buffer.from(output);
  }

  if (typeof Blob !== "undefined" && output instanceof Blob) {
    return Buffer.from(await output.arrayBuffer());
  }

  if (typeof output === "string") {
    return Buffer.from(output, "binary");
  }

  throw new Error("Unsupported PPTX writer output type");
}
