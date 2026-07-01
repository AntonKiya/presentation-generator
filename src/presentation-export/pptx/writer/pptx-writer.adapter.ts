import type {
  PptxWriterChartOptions,
  PptxWriterChartSeries,
  PptxWriterChartType,
  PptxWriterCreateOptions,
  PptxWriterImageOptions,
  PptxWriterPresentation,
  PptxWriterShapeOptions,
  PptxWriterShapeType,
  PptxWriterSlide,
  PptxWriterTableOptions,
  PptxWriterTableRow,
  PptxWriterTextOptions,
  PptxWriterTextRun,
  PptxWriterWriteOptions,
} from "./pptx-writer.types";

export const PPTX_WRITER_ADAPTER = Symbol("PPTX_WRITER_ADAPTER");

export interface PptxWriterAdapter {
  createPresentation(
    options?: PptxWriterCreateOptions,
  ): PptxWriterPresentation;

  addSlide(presentation: PptxWriterPresentation): PptxWriterSlide;

  addText(
    slide: PptxWriterSlide,
    text: string | PptxWriterTextRun[],
    options: PptxWriterTextOptions,
  ): void;

  addShape(
    slide: PptxWriterSlide,
    shape: PptxWriterShapeType,
    options: PptxWriterShapeOptions,
  ): void;

  addImage(slide: PptxWriterSlide, options: PptxWriterImageOptions): void;

  addTable(
    slide: PptxWriterSlide,
    rows: PptxWriterTableRow[],
    options: PptxWriterTableOptions,
  ): void;

  addChart(
    slide: PptxWriterSlide,
    chartType: PptxWriterChartType,
    series: PptxWriterChartSeries[],
    options: PptxWriterChartOptions,
  ): void;

  writeBuffer(
    presentation: PptxWriterPresentation,
    options?: PptxWriterWriteOptions,
  ): Promise<Buffer>;
}
