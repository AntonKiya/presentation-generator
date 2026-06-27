import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  TemplateSchema,
  TemplatesSchema,
  type Template,
  type Templates,
} from "../schemas/template-schema";

export type TemplateRegistry = {
  templates: Templates;
  byId: ReadonlyMap<string, Template>;
};

export async function loadTemplates(
  templatesDir = path.resolve(process.cwd(), "templates"),
): Promise<TemplateRegistry> {
  const fileNames = await readdir(templatesDir);
  const templateFiles = fileNames
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  const templates = await Promise.all(
    templateFiles.map(async (fileName) => {
      const filePath = path.join(templatesDir, fileName);
      const rawTemplate = JSON.parse(await readFile(filePath, "utf8"));
      return TemplateSchema.parse(rawTemplate);
    }),
  );

  return createTemplateRegistry(TemplatesSchema.parse(templates));
}

export function createTemplateRegistry(
  templates: Templates,
): TemplateRegistry {
  const byId = new Map<string, Template>();

  for (const template of templates) {
    if (byId.has(template.id)) {
      throw new Error(`Duplicate template id: ${template.id}`);
    }

    byId.set(template.id, template);
  }

  return {
    templates,
    byId,
  };
}

export function getTemplateById(
  registry: TemplateRegistry,
  templateId: string,
): Template | undefined {
  return registry.byId.get(templateId);
}

export function getAvailableTemplatesForPrompt(
  registry: TemplateRegistry,
): Templates {
  return registry.templates;
}
