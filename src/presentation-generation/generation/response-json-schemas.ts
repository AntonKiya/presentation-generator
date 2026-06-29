import { createHash } from "node:crypto";
import type { Logger } from "@nestjs/common";
import { z } from "zod";
import {
  OutlineGenerationResultSchema,
  PerSlideGenerationResultSchema,
} from "../schemas/generation-schema";

const ELEMENT_TYPES = [
  "title",
  "subtitle",
  "text",
  "bullets",
  "image",
  "cards",
  "table",
  "chart",
];

const CONTAINER_COMMON_PROPERTIES = {
  id: { type: "string", minLength: 1 },
  slot: {
    type: "string",
    enum: ["title", "body", "visual", "data", "comment", "footer"],
  },
  accepts: {
    type: "array",
    minItems: 1,
    items: { type: "string", enum: ELEMENT_TYPES },
  },
  required: { type: "boolean" },
  gap: { type: "number", minimum: 0 },
  padding: { type: "number", minimum: 0 },
  align: { type: "string", enum: ["start", "center", "end", "stretch"] },
  justify: {
    type: "string",
    enum: ["start", "center", "end", "space_between"],
  },
  width: { type: "number", exclusiveMinimum: 0, maximum: 1 },
};

const ELEMENT_COMMON_PROPERTIES = {
  id: { type: "string", minLength: 1 },
  style: { type: "string", minLength: 1 },
  source_reference: { type: "string", minLength: 1 },
};

export const ManualOutlineGenerationResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slides"],
  properties: {
    title: { type: "string", minLength: 1 },
    slides: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "title", "intent"],
        properties: {
          index: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1 },
          intent: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

export const ManualPerSlideGenerationResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["template_id", "slide"],
  properties: {
    template_id: { type: "string", minLength: 1 },
    slide: { $ref: "#/$defs/slide" },
  },
  $defs: {
    slide: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "root_container"],
      properties: {
        id: { type: "string", minLength: 1 },
        type: { const: "slide" },
        root_container: { $ref: "#/$defs/layoutContainer" },
        source_reference: { type: "string", minLength: 1 },
      },
    },
    layoutChild: {
      anyOf: [
        { $ref: "#/$defs/layoutContainer" },
        { $ref: "#/$defs/element" },
      ],
    },
    layoutContainer: {
      anyOf: [
        { $ref: "#/$defs/stackContainer" },
        { $ref: "#/$defs/rowContainer" },
        { $ref: "#/$defs/gridContainer" },
      ],
    },
    stackContainer: {
      type: "object",
      additionalProperties: false,
      required: ["type", "children"],
      properties: {
        ...CONTAINER_COMMON_PROPERTIES,
        type: { const: "stack" },
        children: {
          type: "array",
          items: { $ref: "#/$defs/layoutChild" },
        },
      },
    },
    rowContainer: {
      type: "object",
      additionalProperties: false,
      required: ["type", "children"],
      properties: {
        ...CONTAINER_COMMON_PROPERTIES,
        type: { const: "row" },
        children: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/layoutChild" },
        },
      },
    },
    gridContainer: {
      type: "object",
      additionalProperties: false,
      required: ["type", "columns", "children"],
      properties: {
        ...CONTAINER_COMMON_PROPERTIES,
        type: { const: "grid" },
        columns: {
          anyOf: [
            { type: "integer", minimum: 1 },
            { const: "auto" },
          ],
        },
        children: {
          type: "array",
          items: { $ref: "#/$defs/layoutChild" },
        },
      },
    },
    element: {
      anyOf: [
        { $ref: "#/$defs/titleElement" },
        { $ref: "#/$defs/subtitleElement" },
        { $ref: "#/$defs/textElement" },
        { $ref: "#/$defs/bulletsElement" },
        { $ref: "#/$defs/imageElement" },
        { $ref: "#/$defs/cardsElement" },
        { $ref: "#/$defs/tableElement" },
        { $ref: "#/$defs/chartElement" },
      ],
    },
    titleElement: textLikeElementSchema("title"),
    subtitleElement: textLikeElementSchema("subtitle"),
    textElement: textLikeElementSchema("text"),
    bulletsElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "items"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "bullets" },
        items: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    imageElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "asset_id", "alt"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "image" },
        asset_id: { type: "string", minLength: 1 },
        alt: { type: "string", minLength: 1 },
        fit: { type: "string", enum: ["cover", "contain", "fill"] },
      },
    },
    cardsElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "items"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "cards" },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "text"],
            properties: {
              title: { type: "string", minLength: 1 },
              text: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
    tableElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "columns", "rows"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "table" },
        columns: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        rows: {
          type: "array",
          minItems: 1,
          items: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    chartElement: {
      anyOf: [
        { $ref: "#/$defs/barChartElement" },
        { $ref: "#/$defs/lineChartElement" },
        { $ref: "#/$defs/pieChartElement" },
      ],
    },
    barChartElement: seriesChartElementSchema("bar"),
    lineChartElement: seriesChartElementSchema("line"),
    pieChartElement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "chart_type", "slices"],
      properties: {
        ...ELEMENT_COMMON_PROPERTIES,
        type: { const: "chart" },
        chart_type: { const: "pie" },
        slices: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "value"],
            properties: {
              label: { type: "string", minLength: 1 },
              value: { type: "number" },
            },
          },
        },
        unit: { type: "string", minLength: 1 },
      },
    },
  },
};

function textLikeElementSchema(type: "title" | "subtitle" | "text") {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "text"],
    properties: {
      ...ELEMENT_COMMON_PROPERTIES,
      type: { const: type },
      text: { type: "string", minLength: 1 },
    },
  };
}

function seriesChartElementSchema(chartType: "bar" | "line") {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "chart_type", "labels", "series"],
    properties: {
      ...ELEMENT_COMMON_PROPERTIES,
      type: { const: "chart" },
      chart_type: { const: chartType },
      labels: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
      },
      series: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "values"],
          properties: {
            label: { type: "string", minLength: 1 },
            values: {
              type: "array",
              minItems: 1,
              items: { type: "number" },
            },
          },
        },
      },
      unit: { type: "string", minLength: 1 },
    },
  };
}

export const GeneratedOutlineGenerationResponseJsonSchema =
  createResponseJsonSchemaFromZod(OutlineGenerationResultSchema);

export const GeneratedPerSlideGenerationResponseJsonSchema =
  createResponseJsonSchemaFromZod(PerSlideGenerationResultSchema);

export const OutlineGenerationResponseJsonSchema =
  GeneratedOutlineGenerationResponseJsonSchema;

export const PerSlideGenerationResponseJsonSchema =
  GeneratedPerSlideGenerationResponseJsonSchema;

export type ResponseJsonSchemaComparison = {
  schemaName: string;
  equal: boolean;
  manualBytes: number;
  generatedBytes: number;
  manualHash: string;
  generatedHash: string;
  manualRootRequired: string[];
  generatedRootRequired: string[];
  manualDefinitionKeys: string[];
  generatedDefinitionKeys: string[];
  requiredOnlyInManual: string[];
  requiredOnlyInGenerated: string[];
};

export const ResponseJsonSchemaComparisons: ResponseJsonSchemaComparison[] = [
  compareResponseJsonSchemas(
    "outline_generation_result",
    ManualOutlineGenerationResponseJsonSchema,
    GeneratedOutlineGenerationResponseJsonSchema,
  ),
  compareResponseJsonSchemas(
    "per_slide_generation_result",
    ManualPerSlideGenerationResponseJsonSchema,
    GeneratedPerSlideGenerationResponseJsonSchema,
  ),
];

export function logResponseJsonSchemaComparison(logger: Logger): void {
  for (const comparison of ResponseJsonSchemaComparisons) {
    logger.log(
      `Response JSON Schema comparison schema=${comparison.schemaName} active=generated_from_zod equal=${comparison.equal} manualHash=${comparison.manualHash} generatedHash=${comparison.generatedHash} manualBytes=${comparison.manualBytes} generatedBytes=${comparison.generatedBytes}`,
    );

    if (comparison.requiredOnlyInManual.length > 0) {
      logger.log(
        `Response JSON Schema required only in manual schema=${comparison.schemaName} entries=${comparison.requiredOnlyInManual
          .slice(0, 12)
          .join(" | ")}`,
      );
    }

    if (comparison.requiredOnlyInGenerated.length > 0) {
      logger.log(
        `Response JSON Schema required only in generated schema=${comparison.schemaName} entries=${comparison.requiredOnlyInGenerated
          .slice(0, 12)
          .join(" | ")}`,
      );
    }
  }

  logger.debug(
    `Manual response JSON schemas=${JSON.stringify(
      {
        outline_generation_result: ManualOutlineGenerationResponseJsonSchema,
        per_slide_generation_result: ManualPerSlideGenerationResponseJsonSchema,
      },
      null,
      2,
    )}`,
  );
  logger.debug(
    `Generated response JSON schemas=${JSON.stringify(
      {
        outline_generation_result: GeneratedOutlineGenerationResponseJsonSchema,
        per_slide_generation_result: GeneratedPerSlideGenerationResponseJsonSchema,
      },
      null,
      2,
    )}`,
  );
}

function createResponseJsonSchemaFromZod(
  schema: z.ZodType,
): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-07",
    cycles: "ref",
    reused: "ref",
  }) as Record<string, unknown>;

  delete jsonSchema.$schema;

  return jsonSchema;
}

function compareResponseJsonSchemas(
  schemaName: string,
  manualSchema: Record<string, unknown>,
  generatedSchema: Record<string, unknown>,
): ResponseJsonSchemaComparison {
  const manualSerialized = stableStringify(manualSchema);
  const generatedSerialized = stableStringify(generatedSchema);
  const manualRequired = collectRequiredEntries(manualSchema);
  const generatedRequired = collectRequiredEntries(generatedSchema);

  return {
    schemaName,
    equal: manualSerialized === generatedSerialized,
    manualBytes: manualSerialized.length,
    generatedBytes: generatedSerialized.length,
    manualHash: hashSchema(manualSerialized),
    generatedHash: hashSchema(generatedSerialized),
    manualRootRequired: readStringArray(manualSchema.required),
    generatedRootRequired: readStringArray(generatedSchema.required),
    manualDefinitionKeys: readDefinitionKeys(manualSchema),
    generatedDefinitionKeys: readDefinitionKeys(generatedSchema),
    requiredOnlyInManual: diffSorted(manualRequired, generatedRequired),
    requiredOnlyInGenerated: diffSorted(generatedRequired, manualRequired),
  };
}

function collectRequiredEntries(schema: unknown): Set<string> {
  const requiredEntries = new Set<string>();

  walkSchema(schema, "$", (node, path) => {
    const required = readStringArray(node.required);

    if (required.length > 0) {
      requiredEntries.add(`${path}:${required.join(",")}`);
    }
  });

  return requiredEntries;
}

function walkSchema(
  value: unknown,
  path: string,
  visit: (node: Record<string, unknown>, path: string) => void,
): void {
  if (!isRecord(value)) {
    return;
  }

  visit(value, path);

  for (const key of ["properties", "$defs", "definitions"]) {
    const childMap = value[key];

    if (!isRecord(childMap)) {
      continue;
    }

    for (const [childKey, childValue] of Object.entries(childMap)) {
      walkSchema(childValue, `${path}.${childKey}`, visit);
    }
  }

  for (const key of ["items", "additionalProperties"]) {
    walkSchema(value[key], `${path}.${key}`, visit);
  }

  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const variants = value[key];

    if (!Array.isArray(variants)) {
      continue;
    }

    variants.forEach((variant, index) => {
      walkSchema(variant, `${path}.${key}[${index}]`, visit);
    });
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").sort();
}

function readDefinitionKeys(schema: Record<string, unknown>): string[] {
  const defs = schema.$defs ?? schema.definitions;

  if (!isRecord(defs)) {
    return [];
  }

  return Object.keys(defs).sort();
}

function diffSorted(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}

function hashSchema(serializedSchema: string): string {
  return createHash("sha256").update(serializedSchema).digest("hex").slice(0, 12);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortJsonValue(value[key]);
      return result;
    }, {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
