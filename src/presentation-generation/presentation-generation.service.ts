import { Injectable } from "@nestjs/common";
import { AVAILABLE_ELEMENT_TYPES } from "./schemas/generation-schema";
import { TemplateRegistryService } from "./template-registry.service";

@Injectable()
export class PresentationGenerationService {
  constructor(private readonly templateRegistry: TemplateRegistryService) {}

  getGenerationStaticContext() {
    return {
      templates: this.templateRegistry.getTemplates(),
      elements: AVAILABLE_ELEMENT_TYPES,
    };
  }
}
