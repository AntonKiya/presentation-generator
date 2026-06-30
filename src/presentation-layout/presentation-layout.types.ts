import type {
  LayoutContainer,
} from "../presentation-generation/schemas/container-schema";
import type { Element } from "../presentation-generation/schemas/element-schema";
import type { PresentationLayoutSlideSize } from "./presentation-layout.constants";

export type PresentationLayoutBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PresentationLayoutNodeType = "container" | "element";

export type PresentationLayoutDslType = LayoutContainer["type"] | Element["type"];

export type PresentationLayoutIssueCode = "BOX_TOO_SMALL";

export type PresentationLayoutIssue = {
  severity: "warning";
  code: PresentationLayoutIssueCode;
  message: string;
  slideId?: string;
  nodeId?: string;
  path?: string;
};

export type PresentationLayoutNode = {
  nodeId: string;
  nodeType: PresentationLayoutNodeType;
  dslType: PresentationLayoutDslType;
  path: string;
  box: PresentationLayoutBox;
  children?: PresentationLayoutNode[];
};

export type PresentationSlideLayout = {
  slideId: string;
  slideIndex: number;
  slideSize: PresentationLayoutSlideSize;
  slideBox: PresentationLayoutBox;
  contentBox: PresentationLayoutBox;
  root: PresentationLayoutNode;
  issues: PresentationLayoutIssue[];
};

export type PresentationLayout = {
  presentationId: string;
  slideSize: PresentationLayoutSlideSize;
  slideBox: PresentationLayoutBox;
  slides: PresentationSlideLayout[];
  issues: PresentationLayoutIssue[];
};
