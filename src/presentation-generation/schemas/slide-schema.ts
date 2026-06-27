import { z } from "zod";
import { LayoutContainerSchema } from "./container-schema";

/**
 * Slide schema
 *
 * Важно:
 * - slide не хранит elements напрямую.
 * - все элементы лежат внутри root_container.
 */

export const SlideSchema = z
  .object({
    id: z.string().min(1),

    type: z.literal("slide"),

    root_container: LayoutContainerSchema,

    source_reference: z.string().min(1).optional(),
  })
  .strict();

export const SlidesSchema = z.array(SlideSchema).min(1);

/**
 * Types
 */

export type Slide = z.infer<typeof SlideSchema>;
export type Slides = z.infer<typeof SlidesSchema>;
