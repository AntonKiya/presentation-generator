import {
  GeneratedOutlineGenerationResponseJsonSchema,
  GeneratedPerSlideGenerationResponseJsonSchema,
  ManualOutlineGenerationResponseJsonSchema,
  ManualPerSlideGenerationResponseJsonSchema,
  OutlineGenerationResponseJsonSchema,
  PerSlideGenerationResponseJsonSchema,
} from "../generation/response-json-schemas";

describe("structured response JSON Schema contracts", () => {
  it("uses generated Zod-backed schemas as active response schemas", () => {
    expect(OutlineGenerationResponseJsonSchema).toBe(
      GeneratedOutlineGenerationResponseJsonSchema,
    );
    expect(PerSlideGenerationResponseJsonSchema).toBe(
      GeneratedPerSlideGenerationResponseJsonSchema,
    );
  });

  it("keeps manual schemas available for comparison only", () => {
    expect(ManualOutlineGenerationResponseJsonSchema).toBeDefined();
    expect(ManualPerSlideGenerationResponseJsonSchema).toBeDefined();
    expect(ManualOutlineGenerationResponseJsonSchema).not.toBe(
      OutlineGenerationResponseJsonSchema,
    );
    expect(ManualPerSlideGenerationResponseJsonSchema).not.toBe(
      PerSlideGenerationResponseJsonSchema,
    );
  });

  it("exposes the required outline and per-slide wrapper fields", () => {
    const outlineSchema = OutlineGenerationResponseJsonSchema as JsonSchema;
    const perSlideSchema = PerSlideGenerationResponseJsonSchema as JsonSchema;

    expect(outlineSchema.properties?.slides).toBeDefined();
    expect(outlineSchema.required).toContain("slides");
    expect(perSlideSchema.properties?.template_id).toBeDefined();
    expect(perSlideSchema.properties?.slide).toBeDefined();
    expect(perSlideSchema.required).toEqual(
      expect.arrayContaining(["template_id", "slide"]),
    );
  });
});

type JsonSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};
