import { Injectable, Logger } from "@nestjs/common";
import {
  validatePerSlideGenerationResult,
  type ValidationResult,
} from "./generation/validation";
import type { PerSlideGenerationResult } from "./schemas/generation-schema";
import { TemplateRegistryService } from "./template-registry.service";

@Injectable()
export class GenerationValidationService {
  private readonly logger = new Logger(GenerationValidationService.name);

  constructor(private readonly templateRegistry: TemplateRegistryService) {}

  validatePerSlideResult(
    input: unknown,
  ): ValidationResult<PerSlideGenerationResult> {
    const result = validatePerSlideGenerationResult(
      input,
      this.templateRegistry.getRegistry(),
    );

    if (result.success) {
      this.logger.log(
        `Per-slide result validation ok template=${result.data.template_id} slideId=${result.data.slide.id}`,
      );
    } else {
      this.logger.warn(
        `Per-slide result validation failed issues=${result.issues
          .map((issue) => `${issue.path}:${issue.code}:${issue.message}`)
          .slice(0, 5)
          .join(" | ")}`,
      );
    }

    return result;
  }
}
