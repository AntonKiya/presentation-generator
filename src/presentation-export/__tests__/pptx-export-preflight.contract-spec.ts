import { Logger } from "@nestjs/common";
import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import {
  createAllElementsPresentation,
  createContentSlide,
} from "../../presentation-generation/__tests__/fixtures";
import { PptxExportController } from "../pptx/pptx-export.controller";
import { PptxExportService } from "../pptx/pptx-export.service";
import { PptxLayoutEngineService } from "../pptx/layout";
import { PptxExportPreflightService } from "../pptx/preflight";
import { PptxRendererService } from "../pptx/render";
import { PptxGenJsAdapter } from "../pptx/writer";

describe("PPTX export preflight", () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it("returns ok for a simple exportable presentation", () => {
    const preflight = new PptxExportPreflightService();
    const presentation: Presentation = {
      id: "presentation_ok",
      type: "presentation",
      slides: [createContentSlide()],
    };

    const result = preflight.check(presentation);

    expect(result).toEqual({
      status: "ok",
      issues: [],
    });
  });

  it("returns warnings for supported but approximate MVP export behavior", () => {
    const preflight = new PptxExportPreflightService();
    const presentation = createAllElementsPresentation();

    const result = preflight.check(presentation);

    expect(result.status).toBe("exportable_with_warnings");
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["IMAGE_PLACEHOLDER_USED"]),
    );
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(
      true,
    );
  });

  it("warns about dense content without blocking export", () => {
    const preflight = new PptxExportPreflightService();
    const presentation: Presentation = {
      id: "presentation_dense",
      type: "presentation",
      slides: [
        {
          id: "slide_dense",
          type: "slide",
          root_container: {
            type: "grid",
            columns: "auto",
            children: [
              {
                id: "long_text",
                type: "text",
                text: "Long ".repeat(140),
              },
              {
                id: "many_bullets",
                type: "bullets",
                items: Array.from({ length: 9 }, (_, index) => `Point ${index}`),
              },
              {
                id: "wide_table",
                type: "table",
                columns: ["A", "B", "C", "D", "E", "F"],
                rows: Array.from({ length: 9 }, (_, index) => [
                  `A${index}`,
                  `B${index}`,
                  `C${index}`,
                  `D${index}`,
                  `E${index}`,
                  `F${index}`,
                ]),
              },
              {
                id: "crowded_chart",
                type: "chart",
                chart_type: "bar",
                labels: Array.from({ length: 10 }, (_, index) => `L${index}`),
                series: [
                  {
                    label: "Series",
                    values: Array.from({ length: 10 }, (_, index) => index),
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = preflight.check(presentation);
    const codes = result.issues.map((issue) => issue.code);

    expect(result.status).toBe("exportable_with_warnings");
    expect(codes).toEqual(
      expect.arrayContaining([
        "GRID_AUTO_RESOLVED_APPROXIMATELY",
        "TEXT_MAY_OVERFLOW",
        "BULLETS_MAY_OVERFLOW",
        "TABLE_TOO_MANY_COLUMNS",
        "TABLE_TOO_MANY_ROWS",
        "CHART_TOO_MANY_LABELS",
      ]),
    );
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(
      true,
    );
  });

  it("uses embed image mode as a warning while real assets are not implemented", () => {
    const preflight = new PptxExportPreflightService();
    const result = preflight.check(createAllElementsPresentation(), {
      imageMode: "embed",
    });

    expect(result.status).toBe("exportable_with_warnings");
    expect(result.issues.map((issue) => issue.code)).toContain(
      "IMAGE_ASSET_MISSING",
    );
  });

  it("is exposed through service and controller using validated presentation input", () => {
    const adapter = new PptxGenJsAdapter();
    const service = new PptxExportService(
      new PptxExportPreflightService(),
      new PptxLayoutEngineService(),
      new PptxRendererService(adapter),
      adapter,
    );
    const controller = new PptxExportController(service);
    const presentation = createAllElementsPresentation();

    expect(service.preflightPresentation(presentation).status).toBe(
      "exportable_with_warnings",
    );
    expect(
      controller.preflight({
        presentation,
        options: { imageMode: "placeholder" },
      }).status,
    ).toBe("exportable_with_warnings");
  });
});
