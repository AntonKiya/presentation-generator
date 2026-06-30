import type { Presentation } from "../../../presentation-generation/schemas/presentation-schema";
import type {
  PptxExportIssue,
  PptxExportOptions,
} from "../pptx-export-contract";
import type { PptxPresentationLayout } from "../layout";
import type { PptxWriterPresentation } from "../writer";

export type PptxRenderPresentationInput = {
  presentation: Presentation;
  layout: PptxPresentationLayout;
  options?: Partial<PptxExportOptions>;
};

export type PptxRenderResult = {
  presentation: PptxWriterPresentation;
  layout: PptxPresentationLayout;
  issues: PptxExportIssue[];
  renderedSlides: number;
};
