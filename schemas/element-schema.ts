import { z } from "zod";

/**
 * Common enums
 */

export const ElementTypeSchema = z.enum([
  "title",
  "subtitle",
  "text",
  "bullets",
  "image",
  "cards",
  "table",
  "chart",
]);

export const ImageFitSchema = z.enum(["cover", "contain", "fill"]);

export const ChartTypeSchema = z.enum(["bar", "line", "pie"]);

/**
 * Common fields for all elements.
 */

const CommonElementFields = {
  id: z.string().min(1),
  style: z.string().min(1).optional(),
  source_reference: z.string().min(1).optional(),
};

/**
 * Text-like elements
 */

export const TitleElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("title"),
    text: z.string().min(1),
  })
  .strict();

export const SubtitleElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("subtitle"),
    text: z.string().min(1),
  })
  .strict();

export const TextElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("text"),
    text: z.string().min(1),
  })
  .strict();

/**
 * Bullets
 */

export const BulletsElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("bullets"),
    items: z.array(z.string().min(1)).min(1),
  })
  .strict();

/**
 * Image
 */

export const ImageElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("image"),
    asset_id: z.string().min(1),
    alt: z.string().min(1),
    fit: ImageFitSchema.optional(),
  })
  .strict();

/**
 * Cards
 */

export const CardItemSchema = z
  .object({
    title: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();

export const CardsElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("cards"),
    items: z.array(CardItemSchema).min(1),
  })
  .strict();

/**
 * Table
 */

export const TableElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("table"),
    columns: z.array(z.string().min(1)).min(1),
    rows: z.array(z.array(z.string())).min(1),
  })
  .strict();

/**
 * Chart
 */

export const ChartSeriesSchema = z
  .object({
    label: z.string().min(1),
    values: z.array(z.number()).min(1),
  })
  .strict();

export const BarChartElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("chart"),
    chart_type: z.literal("bar"),
    labels: z.array(z.string().min(1)).min(1),
    series: z.array(ChartSeriesSchema).min(1),
    unit: z.string().min(1).optional(),
  })
  .strict();

export const LineChartElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("chart"),
    chart_type: z.literal("line"),
    labels: z.array(z.string().min(1)).min(1),
    series: z.array(ChartSeriesSchema).min(1),
    unit: z.string().min(1).optional(),
  })
  .strict();

export const PieSliceSchema = z
  .object({
    label: z.string().min(1),
    value: z.number(),
  })
  .strict();

export const PieChartElementSchema = z
  .object({
    ...CommonElementFields,
    type: z.literal("chart"),
    chart_type: z.literal("pie"),
    slices: z.array(PieSliceSchema).min(1),
    unit: z.string().min(1).optional(),
  })
  .strict();

export const ChartElementSchema = z.discriminatedUnion("chart_type", [
  BarChartElementSchema,
  LineChartElementSchema,
  PieChartElementSchema,
]);

/**
 * Final element schema
 */

export const ElementSchema = z
  .discriminatedUnion("type", [
    TitleElementSchema,
    SubtitleElementSchema,
    TextElementSchema,
    BulletsElementSchema,
    ImageElementSchema,
    CardsElementSchema,
    TableElementSchema,
    ChartElementSchema,
  ])
  .superRefine((element, ctx) => {
    if (element.type === "table") {
      element.rows.forEach((row, rowIndex) => {
        if (row.length !== element.columns.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rows", rowIndex],
            message: "Table row length must match columns length",
          });
        }
      });
    }

    if (
      element.type === "chart" &&
      (element.chart_type === "bar" || element.chart_type === "line")
    ) {
      element.series.forEach((seriesItem, seriesIndex) => {
        if (seriesItem.values.length !== element.labels.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["series", seriesIndex, "values"],
            message: "Chart series values length must match labels length",
          });
        }
      });
    }
  });

export const ElementsSchema = z.array(ElementSchema);

/**
 * Types
 */

export type ElementType = z.infer<typeof ElementTypeSchema>;
export type ImageFit = z.infer<typeof ImageFitSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;

export type TitleElement = z.infer<typeof TitleElementSchema>;
export type SubtitleElement = z.infer<typeof SubtitleElementSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type BulletsElement = z.infer<typeof BulletsElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type CardsElement = z.infer<typeof CardsElementSchema>;
export type TableElement = z.infer<typeof TableElementSchema>;
export type ChartElement = z.infer<typeof ChartElementSchema>;

export type Element = z.infer<typeof ElementSchema>;
export type Elements = z.infer<typeof ElementsSchema>;
