import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PresentationExportModule } from "./presentation-export/presentation-export.module";
import { PresentationGenerationModule } from "./presentation-generation/presentation-generation.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PresentationGenerationModule,
    PresentationExportModule,
  ],
})
export class AppModule {}
