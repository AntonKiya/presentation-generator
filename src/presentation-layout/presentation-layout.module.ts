import { Module } from "@nestjs/common";
import { PresentationLayoutEngineService } from "./presentation-layout-engine.service";

@Module({
  providers: [PresentationLayoutEngineService],
  exports: [PresentationLayoutEngineService],
})
export class PresentationLayoutModule {}
