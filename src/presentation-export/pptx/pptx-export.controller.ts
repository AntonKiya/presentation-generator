import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Logger,
  Post,
  Res,
  StreamableFile,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import {
  PresentationSchema,
  type Presentation,
} from "../../presentation-generation/schemas/presentation-schema";
import {
  PptxExportBlockedError,
  PptxExportService,
  PptxExportWriterError,
} from "./pptx-export.service";
import type {
  PptxExportContractResponse,
  PptxExportRequest,
  PptxExportPreflightRequest,
  PptxExportPreflightResponse,
} from "./pptx-export.types";

const PptxExportOptionsInputSchema = z
  .object({
    slideSize: z.literal("wide-16-9").optional(),
    themeId: z.literal("default").optional(),
    imageMode: z.enum(["placeholder", "embed"]).optional(),
    overflowMode: z.enum(["shrink", "warn", "truncate"]).optional(),
    objectMode: z.literal("editable").optional(),
    includeDebug: z.boolean().optional(),
  })
  .strict();

const PptxExportFileNameInputSchema = z.string().min(1).max(140).optional();

type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

@Controller("presentation-export/pptx")
export class PptxExportController {
  private readonly logger = new Logger(PptxExportController.name);

  constructor(private readonly pptxExportService: PptxExportService) {}

  @Get("contract")
  getContract(): PptxExportContractResponse {
    return this.pptxExportService.getContract();
  }

  @Post("preflight")
  preflight(@Body() body: unknown): PptxExportPreflightResponse {
    const request = this.parsePresentationRequestBody(body);

    this.logger.log(
      `POST /presentation-export/pptx/preflight presentationId=${request.presentation.id} slides=${request.presentation.slides.length}`,
    );

    return this.pptxExportService.preflightPresentation(request);
  }

  @Post("export")
  @Header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  )
  async exportPptx(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<StreamableFile> {
    const request = this.parseExportBody(body);

    this.logger.log(
      `POST /presentation-export/pptx/export presentationId=${request.presentation.id} slides=${request.presentation.slides.length}`,
    );

    try {
      const result = await this.pptxExportService.exportPresentation(request);

      response.setHeader("Content-Type", result.mimeType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      response.setHeader("Content-Length", String(result.buffer.length));
      response.setHeader("X-Pptx-Export-Status", result.status);
      response.setHeader("X-Pptx-Export-Issues-Count", String(result.issues.length));

      return new StreamableFile(result.buffer);
    } catch (error) {
      if (error instanceof PptxExportBlockedError) {
        throw new UnprocessableEntityException({
          message: "PPTX export blocked by preflight",
          status: "blocked",
          issues: error.issues,
        });
      }

      if (error instanceof PptxExportWriterError) {
        throw new InternalServerErrorException({
          message: error.message,
          issues: error.issues,
        });
      }

      throw error;
    }
  }

  private parsePresentationRequestBody(body: unknown): PptxExportPreflightRequest {
    const hasPresentationWrapper = isRecord(body) && "presentation" in body;
    const candidate = hasPresentationWrapper ? body.presentation : body;
    const pathPrefix = hasPresentationWrapper ? "presentation" : "";
    const parsedPresentation = PresentationSchema.safeParse(candidate);

    if (!parsedPresentation.success) {
      throw new BadRequestException({
        message: "Invalid presentation schema",
        issues: parsedPresentation.error.issues.map((issue) => ({
          path: [pathPrefix, ...issue.path.map(String)]
            .filter(Boolean)
            .join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    const rawOptions =
      hasPresentationWrapper && isRecord(body) && "options" in body
        ? body.options
        : undefined;
    const parsedOptions =
      rawOptions === undefined
        ? { success: true as const, data: undefined }
        : PptxExportOptionsInputSchema.safeParse(rawOptions);

    if (!parsedOptions.success) {
      throw new BadRequestException({
        message: "Invalid PPTX export options",
        issues: parsedOptions.error.issues.map((issue) => ({
          path: ["options", ...issue.path.map(String)].join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    return {
      presentation: parsedPresentation.data,
      options: parsedOptions.data,
    };
  }

  private parseExportBody(body: unknown): PptxExportRequest {
    const request = this.parsePresentationRequestBody(body);
    const rawFileName =
      isRecord(body) && "fileName" in body ? body.fileName : undefined;
    const parsedFileName = PptxExportFileNameInputSchema.safeParse(rawFileName);

    if (!parsedFileName.success) {
      throw new BadRequestException({
        message: "Invalid PPTX export fileName",
        issues: parsedFileName.error.issues.map((issue) => ({
          path: ["fileName", ...issue.path.map(String)].join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    return {
      ...request,
      fileName: parsedFileName.data,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
