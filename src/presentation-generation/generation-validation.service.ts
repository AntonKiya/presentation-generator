import { Injectable } from "@nestjs/common";
import {
  validatePerSlideGenerationResult,
  type ValidationResult,
} from "./generation/validation";
import type { PerSlideGenerationResult } from "./schemas/generation-schema";
import { TemplateRegistryService } from "./template-registry.service";

@Injectable()
export class GenerationValidationService {
  constructor(private readonly templateRegistry: TemplateRegistryService) {}

  validatePerSlideResult(
    input: unknown,
  ): ValidationResult<PerSlideGenerationResult> {
    return validatePerSlideGenerationResult(
      input,
      this.templateRegistry.getRegistry(),
    );
  }
}
