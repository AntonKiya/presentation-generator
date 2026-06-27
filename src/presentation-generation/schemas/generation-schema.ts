import { z } from "zod";
import { ElementTypeSchema } from "./element-schema";
import { SlideSchema } from "./slide-schema";

/**
 * Contracts for LLM generation steps.
 *
 * These schemas describe LLM response wrappers, not the internal presentation
 * model itself. The final presentation still stores only Slide objects.
 */

export const OutlineSlideSchema = z
  .object({
    index: z.number().int().min(1),
    title: z.string().min(1),
    intent: z.string().min(1).optional(),
  })
  .strict();

export const OutlineGenerationResultSchema = z
  .object({
    title: z.string().min(1).optional(),
    slides: z.array(OutlineSlideSchema).min(1),
  })
  .strict();

export const PerSlideGenerationResultSchema = z
  .object({
    template_id: z.string().min(1),
    slide: SlideSchema,
  })
  .strict();

export const AVAILABLE_ELEMENT_TYPES = ElementTypeSchema.options;

/**
 * Types
 */

export type OutlineSlide = z.infer<typeof OutlineSlideSchema>;
export type OutlineGenerationResult = z.infer<
  typeof OutlineGenerationResultSchema
>;
export type PerSlideGenerationResult = z.infer<
  typeof PerSlideGenerationResultSchema
>;
