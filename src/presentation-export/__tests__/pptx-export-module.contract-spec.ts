import { Logger, StreamableFile } from "@nestjs/common";
import { createContentSlide } from "../../presentation-generation/__tests__/fixtures";
import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import { PptxExportController } from "../pptx/pptx-export.controller";
import { PptxExportService } from "../pptx/pptx-export.service";
import { PptxLayoutEngineService } from "../pptx/layout";
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

describe("PPTX export module boundary", () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it("exposes the PPTX contract through the export service", () => {
    const service = createService();
    const response = service.getContract();

    expect(response.contract.sourceFormat).toBe("presentation_json_dsl");
    expect(response.contract.requiresTemplateId).toBe(false);
    expect(response.contract.usesHtmlPreview).toBe(false);
    expect(response.defaultOptions.imageMode).toBe("placeholder");
    expect(response.support.elements.chart.rendering).toBe("native_chart");
  });

  it("exposes the same contract through the export controller", () => {
    const service = createService();
    const controller = new PptxExportController(service);

    expect(controller.getContract()).toEqual(service.getContract());
  });

  it("exports a PPTX download response through the export controller", async () => {
    const service = createService();
    const controller = new PptxExportController(service);
    const presentation: Presentation = {
      id: "presentation_controller_export",
      type: "presentation",
      slides: [createContentSlide()],
    };
    const response = {
      setHeader: jest.fn(),
    };

    const file = await controller.exportPptx(
      {
        presentation,
        fileName: "Controller Export",
      },
      response as any,
    );

    expect(file).toBeInstanceOf(StreamableFile);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="Controller_Export.pptx"',
    );
    expect(response.setHeader).toHaveBeenCalledWith("X-Pptx-Export-Status", "ok");
  });
});
