import { z } from "zod";
import {
  PerSlideGenerationResultSchema,
  type PerSlideGenerationResult,
} from "../schemas/generation-schema";
import type { Template, Templates } from "../schemas/template-schema";
import type { TemplateRegistry } from "./template-registry";

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      issues: ValidationIssue[];
    };

export function validatePerSlideGenerationResult(
  input: unknown,
  templatesOrRegistry: Templates | TemplateRegistry,
): ValidationResult<PerSlideGenerationResult> {
  const parsed = PerSlideGenerationResultSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      issues: normalizeZodIssues(parsed.error),
    };
  }

  if (!hasTemplateId(templatesOrRegistry, parsed.data.template_id)) {
    return {
      success: false,
      issues: [
        {
          path: "template_id",
          code: "unknown_template",
          message: `Unknown template_id: ${parsed.data.template_id}`,
        },
      ],
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}

export function normalizeZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

function hasTemplateId(
  templatesOrRegistry: Templates | TemplateRegistry,
  templateId: string,
): boolean {
  if ("byId" in templatesOrRegistry) {
    return templatesOrRegistry.byId.has(templateId);
  }

  return templatesOrRegistry.some(
    (template: Template) => template.id === templateId,
  );
}
