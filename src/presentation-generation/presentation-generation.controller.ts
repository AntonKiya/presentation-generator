import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Logger,
  Post,
} from "@nestjs/common";
import {
  GeneratePresentationRequestSchema,
  type GeneratePresentationRequest,
} from "./dto/generate-presentation-request.dto";
import { PresentationGenerationService } from "./presentation-generation.service";
import { PresentationPreviewService } from "./presentation-preview.service";
import {
  PresentationSchema,
  type Presentation,
} from "./schemas/presentation-schema";

@Controller("presentation-generation")
export class PresentationGenerationController {
  private readonly logger = new Logger(PresentationGenerationController.name);

  constructor(
    private readonly generationService: PresentationGenerationService,
    private readonly previewService: PresentationPreviewService,
  ) {}

  @Post("test")
  async test(@Body() body: unknown) {
    const input = this.parseBody(body);

    this.logger.log(
      `POST /presentation-generation/test promptChars=${input.prompt.length} promptPreview="${previewText(input.prompt)}"`,
    );

    return this.generationService.generatePresentation(input.prompt);
  }

  @Post("preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  async preview(@Body() body: unknown): Promise<string> {
    const input = this.parseBody(body);

    this.logger.log(
      `POST /presentation-generation/preview promptChars=${input.prompt.length} promptPreview="${previewText(input.prompt)}"`,
    );

    const result = await this.generationService.generatePresentation(
      input.prompt,
    );

    return this.previewService.renderHtml(result.presentation);
  }

  @Post("html")
  @HttpCode(200)
  @Header("Content-Type", "text/html; charset=utf-8")
  renderHtml(@Body() body: unknown): string {
    const presentation = this.parsePresentationBody(body);

    this.logger.log(
      `POST /presentation-generation/html presentationId=${presentation.id} slides=${presentation.slides.length}`,
    );

    return this.previewService.renderHtml(presentation);
  }

  private parseBody(body: unknown): GeneratePresentationRequest {
    const parsed = GeneratePresentationRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid request body",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    return parsed.data;
  }

  private parsePresentationBody(body: unknown): Presentation {
    const hasPresentationWrapper = isRecord(body) && "presentation" in body;
    const candidate = hasPresentationWrapper ? body.presentation : body;
    const pathPrefix = hasPresentationWrapper ? "presentation" : "";
    const parsed = PresentationSchema.safeParse(candidate);

    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid presentation schema",
        issues: parsed.error.issues.map((issue) => ({
          path: [pathPrefix, ...issue.path.map(String)]
            .filter(Boolean)
            .join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    return parsed.data;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewText(value: string): string {
  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}
