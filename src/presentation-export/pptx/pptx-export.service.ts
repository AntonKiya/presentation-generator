import { Inject, Injectable } from "@nestjs/common";
import {
  PPTX_EXPORT_CONTAINER_SUPPORT,
  PPTX_EXPORT_CONTRACT,
  PPTX_EXPORT_DEFAULT_OPTIONS,
  PPTX_EXPORT_ELEMENT_SUPPORT,
  PPTX_EXPORT_MIME_TYPE,
  PPTX_EXPORT_SUPPORTED_CHART_TYPES,
  type PptxExportIssue,
} from "./pptx-export-contract";
import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import { PptxLayoutEngineService } from "./layout";
import { PptxExportPreflightService } from "./preflight";
import { PptxRendererService } from "./render";
import {
  PPTX_WRITER_ADAPTER,
  type PptxWriterAdapter,
} from "./writer";
import type {
  PptxExportContractResponse,
  PptxExportLayoutRequest,
  PptxExportLayoutResponse,
  PptxExportPreflightRequest,
  PptxExportPreflightResponse,
  PptxExportRequest,
  PptxExportResponse,
  PptxExportRenderRequest,
  PptxExportRenderResponse,
} from "./pptx-export.types";

export class PptxExportBlockedError extends Error {
  constructor(readonly issues: PptxExportIssue[]) {
    super("PPTX export blocked by preflight");
  }
}

export class PptxExportWriterError extends Error {
  constructor(
    message: string,
    readonly issues: PptxExportIssue[],
  ) {
    super(message);
  }
}

@Injectable()
export class PptxExportService {
  constructor(
    private readonly preflightService: PptxExportPreflightService,
    private readonly layoutEngineService: PptxLayoutEngineService,
    private readonly rendererService: PptxRendererService,
    @Inject(PPTX_WRITER_ADAPTER)
    private readonly writer: PptxWriterAdapter,
  ) {}

  getContract(): PptxExportContractResponse {
    return {
      contract: PPTX_EXPORT_CONTRACT,
      mimeType: PPTX_EXPORT_MIME_TYPE,
      defaultOptions: PPTX_EXPORT_DEFAULT_OPTIONS,
      support: {
        containers: PPTX_EXPORT_CONTAINER_SUPPORT,
        elements: PPTX_EXPORT_ELEMENT_SUPPORT,
        charts: PPTX_EXPORT_SUPPORTED_CHART_TYPES,
      },
    };
  }

  preflightPresentation(
    presentationOrRequest: Presentation | PptxExportPreflightRequest,
  ): PptxExportPreflightResponse {
    if ("presentation" in presentationOrRequest) {
      return this.preflightService.check(
        presentationOrRequest.presentation,
        presentationOrRequest.options,
      );
    }

    return this.preflightService.check(presentationOrRequest);
  }

  layoutPresentation(
    presentationOrRequest: Presentation | PptxExportLayoutRequest,
  ): PptxExportLayoutResponse {
    if ("presentation" in presentationOrRequest) {
      return this.layoutEngineService.layoutPresentation(
        presentationOrRequest.presentation,
        presentationOrRequest.options,
      );
    }

    return this.layoutEngineService.layoutPresentation(presentationOrRequest);
  }

  renderPresentation(
    presentationOrRequest: Presentation | PptxExportRenderRequest,
  ): PptxExportRenderResponse {
    const request =
      "presentation" in presentationOrRequest
        ? presentationOrRequest
        : { presentation: presentationOrRequest };
    const layout = this.layoutEngineService.layoutPresentation(
      request.presentation,
      request.options,
    );

    return this.rendererService.renderPresentation({
      presentation: request.presentation,
      layout,
      options: request.options,
    });
  }

  async exportPresentation(
    presentationOrRequest: Presentation | PptxExportRequest,
  ): Promise<PptxExportResponse> {
    const request =
      "presentation" in presentationOrRequest
        ? presentationOrRequest
        : { presentation: presentationOrRequest };
    const preflight = this.preflightService.check(
      request.presentation,
      request.options,
    );

    if (preflight.status === "blocked") {
      throw new PptxExportBlockedError(preflight.issues);
    }

    const renderResult = this.renderPresentation(request);
    const issues = [...preflight.issues, ...renderResult.issues];
    const renderErrors = issues.filter((issue) => issue.severity === "error");

    if (renderErrors.length > 0) {
      throw new PptxExportWriterError("PPTX render failed", renderErrors);
    }

    try {
      const buffer = await this.writer.writeBuffer(renderResult.presentation);

      return {
        buffer,
        mimeType: PPTX_EXPORT_MIME_TYPE,
        fileName: resolvePptxFileName(request.fileName ?? request.presentation.id),
        status: issues.length > 0 ? "exportable_with_warnings" : "ok",
        issues,
      };
    } catch (error) {
      throw new PptxExportWriterError("PPTX writer failed", [
        {
          severity: "error",
          code: "WRITER_FAILURE",
          message: getErrorMessage(error),
        },
      ]);
    }
  }
}

function resolvePptxFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\.pptx$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${sanitized || "presentation"}.pptx`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
