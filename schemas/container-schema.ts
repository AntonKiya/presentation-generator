import { z } from "zod";
import { ElementSchema, ElementTypeSchema } from "./element-schema";

/**
 * Container enums
 */

export const ContainerTypeSchema = z.enum(["stack", "row", "grid"]);

export const AlignSchema = z.enum(["start", "center", "end", "stretch"]);

export const JustifySchema = z.enum([
  "start",
  "center",
  "end",
  "space_between",
]);

export const SlotSchema = z.enum([
  "title",
  "body",
  "visual",
  "data",
  "comment",
  "footer",
]);

export const GridColumnsSchema = z.union([
  z.number().int().min(1),
  z.literal("auto"),
]);

/**
 * Base fields for all layout containers.
 */

const CommonContainerFields = {
  id: z.string().min(1).optional(),

  slot: SlotSchema.optional(),

  accepts: z.array(ElementTypeSchema).min(1).optional(),

  required: z.boolean().optional(),

  gap: z.number().min(0).optional(),

  padding: z.number().min(0).optional(),

  align: AlignSchema.optional(),

  justify: JustifySchema.optional(),

  /**
   * Доля ширины, если узел находится внутри row.
   * Например: 0.5, 0.4, 0.6.
   */
  width: z.number().positive().max(1).optional(),
};

/**
 * Recursive container schema.
 */

export type LayoutChild = z.infer<typeof ElementSchema> | LayoutContainer;

export type LayoutContainer =
  | z.infer<typeof StackContainerSchema>
  | z.infer<typeof RowContainerSchema>
  | z.infer<typeof GridContainerSchema>;

export const LayoutChildSchema: z.ZodType<LayoutChild> = z.lazy(() =>
  z.union([ElementSchema, LayoutContainerSchema]),
);

export const StackContainerSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      ...CommonContainerFields,
      type: z.literal("stack"),
      children: z.array(LayoutChildSchema),
    })
    .strict(),
);

export const RowContainerSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      ...CommonContainerFields,
      type: z.literal("row"),
      children: z.array(LayoutChildSchema).min(1),
    })
    .strict()
    .superRefine((container, ctx) => {
      const widthChildren = container.children.filter(
        (child: any) =>
          typeof child === "object" &&
          child !== null &&
          "width" in child &&
          typeof child.width === "number",
      );

      if (widthChildren.length > 0) {
        const totalWidth = widthChildren.reduce(
          (sum: number, child: any) => sum + child.width,
          0,
        );

        if (Math.abs(totalWidth - 1) > 0.01) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["children"],
            message: "Row children widths should sum to 1",
          });
        }
      }
    }),
);

export const GridContainerSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      ...CommonContainerFields,
      type: z.literal("grid"),
      columns: GridColumnsSchema,
      children: z.array(LayoutChildSchema),
    })
    .strict(),
);

export const LayoutContainerSchema: z.ZodType<LayoutContainer> = z.lazy(() =>
  z.discriminatedUnion("type", [
    StackContainerSchema,
    RowContainerSchema,
    GridContainerSchema,
  ]),
);

/**
 * Final exported schema
 */

export const ContainersSchema = z.array(LayoutContainerSchema);

/**
 * Types
 */

export type ContainerType = z.infer<typeof ContainerTypeSchema>;
export type Align = z.infer<typeof AlignSchema>;
export type Justify = z.infer<typeof JustifySchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type GridColumns = z.infer<typeof GridColumnsSchema>;

export type StackContainer = z.infer<typeof StackContainerSchema>;
export type RowContainer = z.infer<typeof RowContainerSchema>;
export type GridContainer = z.infer<typeof GridContainerSchema>;

export type Container = z.infer<typeof LayoutContainerSchema>;
export type Containers = z.infer<typeof ContainersSchema>;
