import { z } from "zod";
import {
  AlignSchema,
  GridColumnsSchema,
  JustifySchema,
  SlotSchema,
} from "./container-schema";
import { ElementTypeSchema } from "./element-schema";

/**
 * Template layout node
 *
 * Важно:
 * - Это схема именно template layout tree.
 * - Здесь нет реальных элементов.
 * - children содержит только вложенные template layout nodes.
 * - Реальные элементы появятся позже в slide.root_container после генерации.
 */

const TemplateLayoutNodeBaseShape = {
  id: z.string().min(1).optional(),

  slot: SlotSchema.optional(),

  accepts: z.array(ElementTypeSchema).min(1).optional(),

  required: z.boolean().optional().default(false),

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

function validateFillableNode(
  node: {
    slot?: unknown;
    accepts?: unknown[];
    required?: boolean;
  },
  ctx: z.RefinementCtx,
) {
  if (node.required === true && !node.accepts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["required"],
      message: "required=true requires accepts",
    });
  }
}

export const TemplateLayoutNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z
      .object({
        ...TemplateLayoutNodeBaseShape,
        type: z.literal("stack"),
        children: z.array(TemplateLayoutNodeSchema),
      })
      .strict()
      .superRefine(validateFillableNode),

    z
      .object({
        ...TemplateLayoutNodeBaseShape,
        type: z.literal("row"),
        children: z.array(TemplateLayoutNodeSchema).min(1),
      })
      .strict()
      .superRefine((node, ctx) => {
        validateFillableNode(node, ctx);

        const childrenWithWidth = node.children.filter(
          (child: any) => typeof child.width === "number",
        );

        if (childrenWithWidth.length > 0) {
          const totalWidth = childrenWithWidth.reduce(
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

    z
      .object({
        ...TemplateLayoutNodeBaseShape,
        type: z.literal("grid"),
        columns: GridColumnsSchema,
        children: z.array(TemplateLayoutNodeSchema),
      })
      .strict()
      .superRefine(validateFillableNode),
  ]),
);

/**
 * Template limits
 */

export const TemplateLimitsSchema = z
  .object({
    title_max_lines: z.number().int().min(1).optional(),
    subtitle_max_lines: z.number().int().min(1).optional(),
    text_max_lines: z.number().int().min(1).optional(),

    bullets_max_items: z.number().int().min(1).optional(),

    cards_min_items: z.number().int().min(1).optional(),
    cards_max_items: z.number().int().min(1).optional(),

    table_max_rows: z.number().int().min(1).optional(),

    chart_max_series: z.number().int().min(1).optional(),

    images_min_items: z.number().int().min(1).optional(),
    images_max_items: z.number().int().min(1).optional(),
  })
  .strict()
  .superRefine((limits, ctx) => {
    if (
      limits.cards_min_items !== undefined &&
      limits.cards_max_items !== undefined &&
      limits.cards_min_items > limits.cards_max_items
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cards_min_items"],
        message: "cards_min_items must be <= cards_max_items",
      });
    }

    if (
      limits.images_min_items !== undefined &&
      limits.images_max_items !== undefined &&
      limits.images_min_items > limits.images_max_items
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["images_min_items"],
        message: "images_min_items must be <= images_max_items",
      });
    }
  });

/**
 * Simple flexible metadata blocks.
 *
 * - fallbacks: строковые правила
 * - dynamic_rules: простые значения
 * - style_hints: простые значения
 */

const ScalarValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const TemplateFallbacksSchema = z.record(z.string(), z.string());

export const TemplateDynamicRulesSchema = z.record(
  z.string(),
  ScalarValueSchema,
);

export const TemplateStyleHintsSchema = z.record(z.string(), ScalarValueSchema);

/**
 * Final template schema
 */

export const TemplateSchema = z
  .object({
    id: z.string().min(1),

    intent: z.string().min(1),

    layout_container_tree: TemplateLayoutNodeSchema,

    limits: TemplateLimitsSchema.optional(),

    fallbacks: TemplateFallbacksSchema.optional(),

    dynamic_rules: TemplateDynamicRulesSchema.optional(),

    style_hints: TemplateStyleHintsSchema.optional(),
  })
  .strict();

export const TemplatesSchema = z.array(TemplateSchema).min(1);

/**
 * Types
 */

export type TemplateLayoutNode = z.infer<typeof TemplateLayoutNodeSchema>;
export type TemplateLimits = z.infer<typeof TemplateLimitsSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type Templates = z.infer<typeof TemplatesSchema>;
