import type {
  LayoutContainer,
} from "../../../presentation-generation/schemas/container-schema";
import type { Element } from "../../../presentation-generation/schemas/element-schema";
import type {
  PptxExportIssue,
  PptxExportSlideSize,
} from "../pptx-export-contract";

export type PptxLayoutBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PptxLayoutNodeType = "container" | "element";

export type PptxLayoutDslType = LayoutContainer["type"] | Element["type"];

export type PptxLayoutNode = {
  nodeId: string;
  nodeType: PptxLayoutNodeType;
  dslType: PptxLayoutDslType;
  path: string;
  box: PptxLayoutBox;
  children?: PptxLayoutNode[];
};

export type PptxSlideLayout = {
  slideId: string;
  slideIndex: number;
  slideSize: PptxExportSlideSize;
  slideBox: PptxLayoutBox;
  contentBox: PptxLayoutBox;
  root: PptxLayoutNode;
  issues: PptxExportIssue[];
};

export type PptxPresentationLayout = {
  presentationId: string;
  slideSize: PptxExportSlideSize;
  slideBox: PptxLayoutBox;
  slides: PptxSlideLayout[];
  issues: PptxExportIssue[];
};
