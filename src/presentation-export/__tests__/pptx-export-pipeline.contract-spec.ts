import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import {
  createAllElementsPresentation,
  createContentSlide,
} from "../../presentation-generation/__tests__/fixtures";
import { PptxExportService } from "../pptx/pptx-export.service";
import { PptxLayoutEngineService } from "../pptx/layout";
import { PptxExportPreflightService } from "../pptx/preflight";
import { PptxRendererService } from "../pptx/render";
import { PptxGenJsAdapter } from "../pptx/writer";

function createPipeline(): {
  preflight: PptxExportPreflightService;
  service: PptxExportService;
} {
  const adapter = new PptxGenJsAdapter();
  const preflight = new PptxExportPreflightService();
  const layout = new PptxLayoutEngineService();
  const renderer = new PptxRendererService(adapter);

  return {
    preflight,
    service: new PptxExportService(preflight, layout, renderer, adapter),
  };
}

describe("PPTX export pipeline", () => {
  it("runs preflight, layout, render, and writer for all MVP elements", async () => {
    const { preflight, service } = createPipeline();
    const presentation = createAllElementsPresentation();
    const before = structuredClone(presentation);

    const preflightResult = preflight.check(presentation);
    const exportResult = await service.exportPresentation({
      presentation,
      fileName: "all-elements",
    });

    expect(preflightResult.status).toBe("exportable_with_warnings");
    expect(preflightResult.issues.every((issue) => issue.severity === "warning")).toBe(
      true,
    );
    expect(exportResult.fileName).toBe("all-elements.pptx");
    expect(exportResult.status).toBe("exportable_with_warnings");
    expect(exportResult.issues.map((issue) => issue.code)).not.toContain(
      "WRITER_FAILURE",
    );
    expect(exportResult.buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(exportResult.buffer.includes(Buffer.from("ppt/presentation.xml"))).toBe(
      true,
    );
    expect(exportResult.buffer.includes(Buffer.from("ppt/slides/slide1.xml"))).toBe(
      true,
    );
    expect(presentation).toEqual(before);
  });

  it("still writes a PPTX buffer when exportable content has warnings", async () => {
    const { preflight, service } = createPipeline();
    const presentation: Presentation = {
      id: "presentation_warning_pipeline",
      type: "presentation",
      slides: [
        {
          ...createContentSlide(),
          id: "slide_warning_pipeline",
          root_container: {
            type: "stack",
            children: [
              {
                id: "long_text",
                type: "text",
                text: "Long paragraph. ".repeat(120),
              },
              {
                id: "many_cards",
                type: "cards",
                items: Array.from({ length: 8 }, (_, index) => ({
                  title: `Card ${index + 1}`,
                  text: "Dense card text for warning-oriented export testing.",
                })),
              },
              {
                id: "wide_table",
                type: "table",
                columns: ["A", "B", "C", "D", "E", "F"],
                rows: Array.from({ length: 10 }, (_, index) => [
                  `A${index}`,
                  `B${index}`,
                  `C${index}`,
                  `D${index}`,
                  `E${index}`,
                  `F${index}`,
                ]),
              },
            ],
          },
        },
      ],
    };

    const preflightResult = preflight.check(presentation);
    const exportResult = await service.exportPresentation(presentation);

    expect(preflightResult.status).toBe("exportable_with_warnings");
    expect(preflightResult.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "TEXT_MAY_OVERFLOW",
        "CARDS_MAY_OVERFLOW",
        "TABLE_TOO_MANY_COLUMNS",
        "TABLE_TOO_MANY_ROWS",
      ]),
    );
    expect(preflightResult.issues.every((issue) => issue.severity === "warning")).toBe(
      true,
    );
    expect(exportResult.issues.map((issue) => issue.severity)).not.toContain(
      "error",
    );
    expect(exportResult.buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
