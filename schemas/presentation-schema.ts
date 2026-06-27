import { z } from "zod";
import { SlideSchema } from "./slide-schema";

/**
 * Presentation schema
 *
 * Важно:
 * - presentation — корневой объект всей презентации.
 * - presentation хранит slides.
 * - elements не лежат напрямую на уровне presentation.
 */

export const PresentationSchema = z
  .object({
    id: z.string().min(1),

    type: z.literal("presentation"),

    title: z.string().min(1).optional(),

    slides: z.array(SlideSchema).min(1),
  })
  .strict();

/**
 * Types
 */

export type Presentation = z.infer<typeof PresentationSchema>;
