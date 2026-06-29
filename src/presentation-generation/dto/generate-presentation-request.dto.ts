import { z } from "zod";

export const GeneratePresentationRequestSchema = z
  .object({
    prompt: z.string().min(1),
  })
  .strict();

export type GeneratePresentationRequest = z.infer<
  typeof GeneratePresentationRequestSchema
>;
