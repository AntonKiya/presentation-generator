import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import {
  createAllElementsPresentation,
  createContentSlide,
} from "../../presentation-generation/__tests__/fixtures";
import {
  PptxExportService,
  PptxLayoutEngineService,
  PptxRendererService,
} from "../pptx";
import { PptxExportPreflightService } from "../pptx/preflight";
import { PptxGenJsAdapter } from "../pptx/writer";

function createRendererFixture(): {
  adapter: PptxGenJsAdapter;
  layoutEngine: PptxLayoutEngineService;
  renderer: PptxRendererService;
} {
  const adapter = new PptxGenJsAdapter();

  return {
    adapter,
    layoutEngine: new PptxLayoutEngineService(),
    renderer: new PptxRendererService(adapter),
  };
}

describe("PPTX renderer", () => {
  it("renders every MVP element through the writer adapter into a PPTX buffer", async () => {
    const { adapter, layoutEngine, renderer } = createRendererFixture();
    const presentation = createAllElementsPresentation();
    const layout = layoutEngine.layoutPresentation(presentation);

    const result = renderer.renderPresentation({
      presentation,
      layout,
    });
    const buffer = await adapter.writeBuffer(result.presentation);

    expect(result.renderedSlides).toBe(1);
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      "WRITER_FAILURE",
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5000);
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("renders native bar, line, and pie charts without changing the DSL", async () => {
    const { adapter, layoutEngine, renderer } = createRendererFixture();
    const presentation: Presentation = {
      id: "presentation_charts",
      type: "presentation",
      slides: [
        {
          id: "slide_charts",
          type: "slide",
          root_container: {
            type: "grid",
            columns: 3,
            gap: 12,
            children: [
              {
                id: "chart_bar",
                type: "chart",
                chart_type: "bar",
                labels: ["A", "B"],
                series: [{ label: "Bar", values: [1, 2] }],
              },
              {
                id: "chart_line",
                type: "chart",
                chart_type: "line",
                labels: ["A", "B"],
                series: [{ label: "Line", values: [2, 3] }],
              },
              {
                id: "chart_pie",
                type: "chart",
                chart_type: "pie",
                slices: [
                  { label: "One", value: 60 },
                  { label: "Two", value: 40 },
                ],
              },
            ],
          },
        },
      ],
    };
    const before = structuredClone(presentation);
    const layout = layoutEngine.layoutPresentation(presentation);

    const result = renderer.renderPresentation({ presentation, layout });
    const buffer = await adapter.writeBuffer(result.presentation);

    expect(result.issues.map((issue) => issue.code)).not.toContain(
      "WRITER_FAILURE",
    );
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(presentation).toEqual(before);
  });

  it("is exposed through the PPTX export service", async () => {
    const adapter = new PptxGenJsAdapter();
    const service = new PptxExportService(
      new PptxExportPreflightService(),
      new PptxLayoutEngineService(),
      new PptxRendererService(adapter),
      adapter,
    );
    const presentation: Presentation = {
      id: "presentation_service_render",
      type: "presentation",
      slides: [createContentSlide()],
    };

    const result = service.renderPresentation({
      presentation,
      options: { includeDebug: true },
    });
    const buffer = await adapter.writeBuffer(result.presentation);

    expect(result.renderedSlides).toBe(1);
    expect(result.layout.slides).toHaveLength(1);
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
