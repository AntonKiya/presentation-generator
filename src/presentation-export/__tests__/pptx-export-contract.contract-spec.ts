import { ContainerTypeSchema } from "../../presentation-generation/schemas/container-schema";
import { AVAILABLE_ELEMENT_TYPES } from "../../presentation-generation/schemas/generation-schema";
import {
  PPTX_EXPORT_CONTAINER_SUPPORT,
  PPTX_EXPORT_CONTRACT,
  PPTX_EXPORT_DEFAULT_OPTIONS,
  PPTX_EXPORT_ELEMENT_SUPPORT,
  PPTX_EXPORT_MIME_TYPE,
  PPTX_EXPORT_SLIDE_SIZES,
  PPTX_EXPORT_SUPPORTED_CHART_TYPES,
  PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES,
  PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES,
} from "../pptx";

describe("PPTX export contract", () => {
  it("keeps JSON DSL as source of truth and does not depend on HTML or template_id", () => {
    expect(PPTX_EXPORT_CONTRACT.sourceFormat).toBe("presentation_json_dsl");
    expect(PPTX_EXPORT_CONTRACT.targetFormat).toBe("pptx");
    expect(PPTX_EXPORT_CONTRACT.inputRequiresValidPresentation).toBe(true);
    expect(PPTX_EXPORT_CONTRACT.requiresTemplateId).toBe(false);
    expect(PPTX_EXPORT_CONTRACT.usesHtmlPreview).toBe(false);
    expect(PPTX_EXPORT_CONTRACT.outputObjectMode).toBe("editable");
    expect(PPTX_EXPORT_CONTRACT.pixelPerfectParity).toBe(false);
    expect(PPTX_EXPORT_MIME_TYPE).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
  });

  it("supports every current MVP DSL element explicitly", () => {
    expect([...PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES].sort()).toEqual(
      [...AVAILABLE_ELEMENT_TYPES].sort(),
    );
    expect(Object.keys(PPTX_EXPORT_ELEMENT_SUPPORT).sort()).toEqual(
      [...AVAILABLE_ELEMENT_TYPES].sort(),
    );
    expect(PPTX_EXPORT_SUPPORTED_ELEMENT_TYPES).not.toContain("section");
  });

  it("supports every current MVP layout container explicitly", () => {
    expect([...PPTX_EXPORT_SUPPORTED_CONTAINER_TYPES].sort()).toEqual(
      [...ContainerTypeSchema.options].sort(),
    );
    expect(Object.keys(PPTX_EXPORT_CONTAINER_SUPPORT).sort()).toEqual(
      [...ContainerTypeSchema.options].sort(),
    );
  });

  it("defines conservative MVP defaults", () => {
    expect(PPTX_EXPORT_DEFAULT_OPTIONS).toEqual({
      slideSize: "wide-16-9",
      themeId: "default",
      imageMode: "placeholder",
      overflowMode: "shrink",
      objectMode: "editable",
      includeDebug: false,
    });
    expect(PPTX_EXPORT_SLIDE_SIZES["wide-16-9"]).toEqual({
      width: 13.333,
      height: 7.5,
    });
  });

  it("supports only current chart DSL types", () => {
    expect([...PPTX_EXPORT_SUPPORTED_CHART_TYPES].sort()).toEqual([
      "bar",
      "line",
      "pie",
    ]);
  });
});
