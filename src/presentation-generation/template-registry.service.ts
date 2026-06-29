import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  getAvailableTemplatesForPrompt,
  getTemplateById,
  loadTemplates,
  type TemplateRegistry,
} from "./generation/template-registry";
import type { Template, Templates } from "./schemas/template-schema";

@Injectable()
export class TemplateRegistryService implements OnModuleInit {
  private readonly logger = new Logger(TemplateRegistryService.name);
  private registry?: TemplateRegistry;

  async onModuleInit(): Promise<void> {
    const startedAt = Date.now();

    this.logger.log("Loading presentation templates");

    try {
      this.registry = await loadTemplates();
      this.logger.log(
        `Templates loaded count=${this.registry.templates.length} ids=${this.registry.templates
          .map((template) => template.id)
          .join(",")} durationMs=${Date.now() - startedAt}`,
      );
    } catch (error) {
      this.logger.error(
        `Template loading failed durationMs=${Date.now() - startedAt} error=${formatError(error)}`,
      );
      throw error;
    }
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

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
