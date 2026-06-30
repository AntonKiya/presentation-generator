import { Module } from "@nestjs/common";
import { PresentationLayoutModule } from "../presentation-layout";
import { GenerationValidationService } from "./generation-validation.service";
import { OpenRouterLlmService } from "./openrouter-llm.service";
import { PresentationGenerationController } from "./presentation-generation.controller";
import { PresentationGenerationService } from "./presentation-generation.service";
import { PresentationPreviewService } from "./presentation-preview.service";
import { TemplateRegistryService } from "./template-registry.service";

@Module({
  imports: [PresentationLayoutModule],
  controllers: [PresentationGenerationController],
  providers: [
    TemplateRegistryService,
    GenerationValidationService,
    OpenRouterLlmService,
    PresentationGenerationService,
    PresentationPreviewService,
  ],
  exports: [
    TemplateRegistryService,
    GenerationValidationService,
    PresentationGenerationService,
  ],
})
export class PresentationGenerationModule {}
