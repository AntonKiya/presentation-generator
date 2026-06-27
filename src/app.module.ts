import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PresentationGenerationModule } from "./presentation-generation/presentation-generation.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PresentationGenerationModule,
  ],
})
export class AppModule {}
