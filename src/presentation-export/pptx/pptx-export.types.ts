import type {
  PPTX_EXPORT_CONTAINER_SUPPORT,
  PPTX_EXPORT_CONTRACT,
  PPTX_EXPORT_DEFAULT_OPTIONS,
  PPTX_EXPORT_ELEMENT_SUPPORT,
  PPTX_EXPORT_MIME_TYPE,
  PPTX_EXPORT_SUPPORTED_CHART_TYPES,
} from "./pptx-export-contract";
import type {
  PptxExportOptions,
  PptxExportPreflightResult,
  PptxExportResult,
} from "./pptx-export-contract";
import type { PptxPresentationLayout } from "./layout";
import type { PptxRenderResult } from "./render";
import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";

export type PptxExportContractResponse = {
  contract: typeof PPTX_EXPORT_CONTRACT;
  mimeType: typeof PPTX_EXPORT_MIME_TYPE;
  defaultOptions: typeof PPTX_EXPORT_DEFAULT_OPTIONS;
  support: {
    containers: typeof PPTX_EXPORT_CONTAINER_SUPPORT;
    elements: typeof PPTX_EXPORT_ELEMENT_SUPPORT;
    charts: typeof PPTX_EXPORT_SUPPORTED_CHART_TYPES;
  };
};

export type PptxExportPreflightRequest = {
  presentation: Presentation;
  options?: Partial<PptxExportOptions>;
};

export type PptxExportPreflightResponse = PptxExportPreflightResult;

export type PptxExportLayoutRequest = {
  presentation: Presentation;
  options?: Partial<PptxExportOptions>;
};

export type PptxExportLayoutResponse = PptxPresentationLayout;

export type PptxExportRenderRequest = {
  presentation: Presentation;
  options?: Partial<PptxExportOptions>;
};

export type PptxExportRenderResponse = PptxRenderResult;

export type PptxExportRequest = {
  presentation: Presentation;
  options?: Partial<PptxExportOptions>;
  fileName?: string;
};

export type PptxExportResponse = PptxExportResult;
