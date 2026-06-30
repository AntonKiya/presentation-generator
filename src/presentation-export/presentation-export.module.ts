import { Module } from "@nestjs/common";
import { PptxExportModule } from "./pptx/pptx-export.module";

@Module({
  imports: [PptxExportModule],
  exports: [PptxExportModule],
})
export class PresentationExportModule {}
