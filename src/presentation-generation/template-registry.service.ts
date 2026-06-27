import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  getAvailableTemplatesForPrompt,
  getTemplateById,
  loadTemplates,
  type TemplateRegistry,
} from "./generation/template-registry";
import type { Template, Templates } from "./schemas/template-schema";

@Injectable()
export class TemplateRegistryService implements OnModuleInit {
  private registry?: TemplateRegistry;

  async onModuleInit(): Promise<void> {
    this.registry = await loadTemplates();
  }

  getRegistry(): TemplateRegistry {
    if (!this.registry) {
      throw new Error("Template registry is not initialized yet");
    }

    return this.registry;
  }

  getTemplates(): Templates {
    return getAvailableTemplatesForPrompt(this.getRegistry());
  }

  getTemplateById(templateId: string): Template | undefined {
    return getTemplateById(this.getRegistry(), templateId);
  }
}
