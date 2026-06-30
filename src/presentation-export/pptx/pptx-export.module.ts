import { Module } from "@nestjs/common";
import { PptxExportController } from "./pptx-export.controller";
import { PptxExportService } from "./pptx-export.service";
import { PptxLayoutEngineService } from "./layout";
import { PptxExportPreflightService } from "./preflight";
import { PptxRendererService } from "./render";
import { PPTX_WRITER_ADAPTER, PptxGenJsAdapter } from "./writer";

@Module({
  controllers: [PptxExportController],
  providers: [
    PptxExportService,
    PptxExportPreflightService,
    PptxLayoutEngineService,
    PptxRendererService,
    PptxGenJsAdapter,
    {
      provide: PPTX_WRITER_ADAPTER,
      useExisting: PptxGenJsAdapter,
    },
  ],
  exports: [
    PptxExportService,
    PptxExportPreflightService,
    PptxLayoutEngineService,
    PptxRendererService,
    PptxGenJsAdapter,
    PPTX_WRITER_ADAPTER,
  ],
})
export class PptxExportModule {}
