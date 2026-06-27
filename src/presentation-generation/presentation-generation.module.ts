import { Module } from "@nestjs/common";
import { GenerationValidationService } from "./generation-validation.service";
import { PresentationGenerationService } from "./presentation-generation.service";
import { TemplateRegistryService } from "./template-registry.service";

@Module({
  providers: [
    TemplateRegistryService,
    GenerationValidationService,
    PresentationGenerationService,
  ],
  exports: [
    TemplateRegistryService,
    GenerationValidationService,
    PresentationGenerationService,
  ],
})
export class PresentationGenerationModule {}
