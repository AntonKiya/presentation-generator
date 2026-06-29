import {
  PerSlideGenerationResultSchema,
  type PerSlideGenerationResult,
} from "../schemas/generation-schema";
import type { Template, Templates } from "../schemas/template-schema";
import type { TemplateRegistry } from "../generation/template-registry";
import { validateSlideAgainstTemplate } from "./slide-template.validator";
import {
  invalid,
  normalizeZodIssues,
  prefixValidationIssues,
  valid,
  type ValidationResult,
} from "./validation-result";

/**
 * Validates the complete per-slide LLM response wrapper.
 *
 * This is the boundary between generation and the internal DSL:
 * - Zod validates the response shape.
 * - template_id is resolved against loaded templates.
 * - the generated slide is checked against the selected template rules.
 */
export function validatePerSlideGenerationResult(
  input: unknown,
  templatesOrRegistry: Templates | TemplateRegistry,
): ValidationResult<PerSlideGenerationResult> {
  const parsed = PerSlideGenerationResultSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(normalizeZodIssues(parsed.error));
  }

  const template = getTemplate(templatesOrRegistry, parsed.data.template_id);

  if (!template) {
    return invalid([
      {
        path: "template_id",
        code: "unknown_template",
        message: `Unknown template_id: ${parsed.data.template_id}`,
      },
    ]);
  }

  const templateValidation = validateSlideAgainstTemplate(
    parsed.data.slide,
    template,
  );

  if (!templateValidation.success) {
    return invalid(prefixValidationIssues("slide", templateValidation.issues));
  }

  return valid(parsed.data);
}

function getTemplate(
  templatesOrRegistry: Templates | TemplateRegistry,
  templateId: string,
): Template | undefined {
  if ("byId" in templatesOrRegistry) {
    return templatesOrRegistry.byId.get(templateId);
  }

  return templatesOrRegistry.find(
    (template: Template) => template.id === templateId,
  );
}
