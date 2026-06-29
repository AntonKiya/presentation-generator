import type { Template } from "../schemas/template-schema";
import { validatePerSlideGenerationResult } from "../validation";
import { validateSlideAgainstTemplate } from "../validation/slide-template.validator";
import { validateSlideTemplateLimits } from "../validation/template-limits.validator";
import {
  cloneSlide,
  createContentSlide,
  createDataFocusChartSlide,
  createDataFocusTableSlide,
  getContainerChild,
  loadTemplateFixture,
} from "./fixtures";

describe("template validation contracts", () => {
  let contentTemplate: Template;
  let dataFocusTemplate: Template;

  beforeAll(async () => {
    contentTemplate = await loadTemplateFixture("content");
    dataFocusTemplate = await loadTemplateFixture("data_focus");
  });

  it("accepts a slide that follows the selected template", () => {
    const result = validateSlideAgainstTemplate(
      createContentSlide(),
      contentTemplate,
    );

    expect(result.success).toBe(true);
  });

  it("rejects missing required slot content", () => {
    const slide = createContentSlide();
    const bodySlot = getContainerChild(slide.root_container, 1);
    bodySlot.children = [];

    const result = validateSlideAgainstTemplate(slide, contentTemplate);

    expect(issueCodes(result)).toContain("required_slot_empty");
  });

  it("rejects elements outside the parent slot accepts list", () => {
    const slide = createContentSlide();
    const bodySlot = getContainerChild(slide.root_container, 1);
    bodySlot.children = [
      {
        id: "llm_image",
        type: "image",
        asset_id: "placeholder://image",
        alt: "Image is not accepted in content body",
      },
    ];

    const result = validateSlideAgainstTemplate(slide, contentTemplate);

    expect(issueCodes(result)).toContain("slot_element_type_not_accepted");
  });

  it("allows nested layout containers inside fillable slots", () => {
    const slide = createContentSlide();
    const bodySlot = getContainerChild(slide.root_container, 1);
    bodySlot.children = [
      {
        type: "stack",
        children: [
          {
            id: "nested_text",
            type: "text",
            text: "Nested local layout is allowed.",
          },
        ],
      },
    ];

    const result = validateSlideAgainstTemplate(slide, contentTemplate);

    expect(result.success).toBe(true);
  });

  it("rejects slot metadata on nested containers inside fillable slots", () => {
    const slide = createContentSlide();
    const bodySlot = getContainerChild(slide.root_container, 1);
    bodySlot.children = [
      {
        type: "stack",
        slot: "body",
        children: [
          {
            id: "nested_text",
            type: "text",
            text: "Nested content.",
          },
        ],
      },
    ];

    const result = validateSlideAgainstTemplate(slide, contentTemplate);

    expect(issueCodes(result)).toContain("nested_slot_not_allowed");
  });

  it("rejects structural changes before a fillable slot", () => {
    const slide = createContentSlide();
    slide.root_container.children = [slide.root_container.children[0]];

    const result = validateSlideAgainstTemplate(slide, contentTemplate);

    expect(issueCodes(result)).toContain("template_children_count_mismatch");
  });

  it("validates the complete per-slide wrapper contract", () => {
    const result = validatePerSlideGenerationResult(
      {
        template_id: "content",
        slide: createContentSlide(),
      },
      [contentTemplate],
    );

    expect(result.success).toBe(true);
  });

  it("rejects unknown template ids in the per-slide wrapper", () => {
    const result = validatePerSlideGenerationResult(
      {
        template_id: "unknown_template",
        slide: createContentSlide(),
      },
      [contentTemplate],
    );

    expect(issueCodes(result)).toContain("unknown_template");
  });

  it("flags count-like template limits", () => {
    const slide = createContentSlide();
    const bodySlot = getContainerChild(slide.root_container, 1);
    bodySlot.children = [
      {
        id: "too_many_bullets",
        type: "bullets",
        items: ["One", "Two", "Three", "Four", "Five", "Six"],
      },
    ];

    const result = validateSlideTemplateLimits(slide, contentTemplate);

    expect(issueCodes(result)).toContain(
      "template_limit_bullets_max_items_exceeded",
    );
  });

  it("flags table row and chart series limits", () => {
    const tableResult = validateSlideTemplateLimits(
      createDataFocusTableSlide(7),
      dataFocusTemplate,
    );
    const chartResult = validateSlideTemplateLimits(
      createDataFocusChartSlide(5),
      dataFocusTemplate,
    );

    expect(issueCodes(tableResult)).toContain(
      "template_limit_table_max_rows_exceeded",
    );
    expect(issueCodes(chartResult)).toContain(
      "template_limit_chart_max_series_exceeded",
    );
  });

  it("does not validate renderer-dependent line limits", () => {
    const slide = cloneSlide(createContentSlide());
    const titleSlot = getContainerChild(slide.root_container, 0);
    const title = titleSlot.children[0];

    if (!title || title.type !== "title") {
      throw new Error("Expected title fixture");
    }

    title.text = "Line 1\nLine 2\nLine 3";

    const result = validateSlideTemplateLimits(slide, contentTemplate);

    expect(result.success).toBe(true);
  });
});

function issueCodes(
  result: ReturnType<
    | typeof validateSlideAgainstTemplate
    | typeof validateSlideTemplateLimits
    | typeof validatePerSlideGenerationResult
  >,
): string[] {
  return result.success ? [] : result.issues.map((issue) => issue.code);
}
