import { normalizeSlideIds } from "../generation/slide-id-normalizer";
import type { LayoutContainer } from "../schemas/container-schema";
import type { Slide } from "../schemas/slide-schema";

describe("slide id normalizer contract", () => {
  it("overwrites LLM ids with deterministic backend-owned ids", () => {
    const slide: Slide = {
      id: "llm_slide",
      type: "slide",
      root_container: {
        id: "llm_root",
        type: "stack",
        children: [
          {
            id: "duplicate",
            type: "title",
            text: "Title",
          },
          {
            type: "row",
            children: [
              {
                id: "llm_column",
                type: "stack",
                children: [
                  {
                    id: "duplicate",
                    type: "text",
                    text: "Text",
                  },
                ],
              },
              {
                type: "stack",
                children: [
                  {
                    id: "duplicate",
                    type: "image",
                    asset_id: "placeholder://image",
                    alt: "Image",
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const normalized = normalizeSlideIds(slide, 2);
    const row = normalized.root_container.children[1] as LayoutContainer;
    const firstColumn = row.children[0] as LayoutContainer;
    const secondColumn = row.children[1] as LayoutContainer;

    expect(normalized.id).toBe("slide_2");
    expect(normalized.root_container.id).toBe("container_2_1");
    expect(firstColumn.id).toBe("container_2_2");
    expect(secondColumn.id).toBeUndefined();
    expect(normalized.root_container.children[0]).toMatchObject({
      id: "el_2_1",
      type: "title",
    });
    expect(firstColumn.children[0]).toMatchObject({
      id: "el_2_2",
      type: "text",
    });
    expect(secondColumn.children[0]).toMatchObject({
      id: "el_2_3",
      type: "image",
    });
  });
});
