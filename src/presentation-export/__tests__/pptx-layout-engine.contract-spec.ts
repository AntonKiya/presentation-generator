import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import {
  createAllElementsPresentation,
  createContentSlide,
  createDataFocusChartSlide,
} from "../../presentation-generation/__tests__/fixtures";
import {
  PPTX_EXPORT_SLIDE_SIZES,
  PptxExportService,
  PptxLayoutEngineService,
  resolveGridColumns,
} from "../pptx";
import { PptxExportPreflightService } from "../pptx/preflight";
import { PptxRendererService } from "../pptx/render";
import { PptxGenJsAdapter } from "../pptx/writer";

function createService(): PptxExportService {
  const adapter = new PptxGenJsAdapter();

  return new PptxExportService(
    new PptxExportPreflightService(),
    new PptxLayoutEngineService(),
    new PptxRendererService(adapter),
    adapter,
  );
}

describe("PPTX layout engine", () => {
  it("layouts a presentation inside the deterministic wide safe area", () => {
    const engine = new PptxLayoutEngineService();
    const presentation: Presentation = {
      id: "presentation_layout",
      type: "presentation",
      slides: [createContentSlide()],
    };

    const layout = engine.layoutPresentation(presentation);
    const slide = layout.slides[0];

    expect(layout.presentationId).toBe("presentation_layout");
    expect(layout.slideSize).toBe("wide-16-9");
    expect(layout.slideBox).toEqual({
      x: 0,
      y: 0,
      w: PPTX_EXPORT_SLIDE_SIZES["wide-16-9"].width,
      h: PPTX_EXPORT_SLIDE_SIZES["wide-16-9"].height,
    });
    expect(slide.contentBox.x).toBeGreaterThan(0);
    expect(slide.contentBox.y).toBeGreaterThan(0);
    expect(slide.root.box).toEqual(slide.contentBox);
    expect(slide.root.children).toHaveLength(2);
    expect(layout.issues).toEqual([]);
  });

  it("keeps title containers compact and gives body containers remaining stack height", () => {
    const engine = new PptxLayoutEngineService();
    const slide = engine.layoutSlide(createContentSlide());
    const [titleContainer, bodyContainer] = slide.root.children ?? [];

    expect(titleContainer.dslType).toBe("stack");
    expect(bodyContainer.dslType).toBe("stack");
    expect(titleContainer.box.h).toBeLessThan(bodyContainer.box.h);
    expect(bodyContainer.box.y).toBeGreaterThan(titleContainer.box.y);
  });

  it("respects row child width fractions after subtracting gap", () => {
    const engine = new PptxLayoutEngineService();
    const slide = engine.layoutSlide(createDataFocusChartSlide());
    const row = slide.root.children?.[1];
    const [dataColumn, commentColumn] = row?.children ?? [];

    expect(row?.dslType).toBe("row");
    expect(dataColumn.box.w).toBeGreaterThan(commentColumn.box.w);
    expect(dataColumn.box.w / (dataColumn.box.w + commentColumn.box.w)).toBeCloseTo(
      0.65,
      1,
    );
    expect(commentColumn.box.x).toBeGreaterThan(dataColumn.box.x);
  });

  it("resolves auto grid columns deterministically", () => {
    expect(resolveGridColumns("auto", 1)).toBe(1);
    expect(resolveGridColumns("auto", 3)).toBe(2);
    expect(resolveGridColumns("auto", 5)).toBe(3);
    expect(resolveGridColumns("auto", 8)).toBe(4);
    expect(resolveGridColumns(4, 2)).toBe(2);
  });

  it("lays grid children in row-major cells", () => {
    const engine = new PptxLayoutEngineService();
    const presentation = createAllElementsPresentation();
    const slide = presentation.slides[0];

    slide.root_container = {
      type: "grid",
      columns: "auto",
      gap: 16,
      children: [
        { id: "one", type: "text", text: "One" },
        { id: "two", type: "text", text: "Two" },
        { id: "three", type: "text", text: "Three" },
        { id: "four", type: "text", text: "Four" },
      ],
    };

    const layout = engine.layoutSlide(slide);
    const [one, two, three, four] = layout.root.children ?? [];

    expect(one.box.y).toBeCloseTo(two.box.y);
    expect(three.box.y).toBeGreaterThan(one.box.y);
    expect(two.box.x).toBeGreaterThan(one.box.x);
    expect(four.box.x).toBeGreaterThan(three.box.x);
  });

  it("returns BOX_TOO_SMALL warnings without mutating the presentation", () => {
    const engine = new PptxLayoutEngineService();
    const presentation: Presentation = {
      id: "presentation_tiny",
      type: "presentation",
      slides: [
        {
          id: "slide_tiny",
          type: "slide",
          root_container: {
            type: "stack",
            children: Array.from({ length: 40 }, (_, index) => ({
              id: `el_${index}`,
              type: "text" as const,
              text: `Text ${index}`,
            })),
          },
        },
      ],
    };
    const before = structuredClone(presentation);

    const layout = engine.layoutPresentation(presentation);

    expect(layout.issues.map((issue) => issue.code)).toContain("BOX_TOO_SMALL");
    expect(presentation).toEqual(before);
  });

  it("is exposed through the PPTX export service", () => {
    const service = createService();
    const presentation: Presentation = {
      id: "presentation_service_layout",
      type: "presentation",
      slides: [createContentSlide()],
    };

    const layout = service.layoutPresentation({
      presentation,
      options: { slideSize: "wide-16-9" },
    });

    expect(layout.presentationId).toBe("presentation_service_layout");
    expect(layout.slides).toHaveLength(1);
  });
});
