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

export type PresentationLayoutIssueCode =
  | "BOX_TOO_SMALL"
  | "BULLETS_MAY_OVERFLOW";

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
  internal?: PresentationElementInternalLayout;
  children?: PresentationLayoutNode[];
};

export type PresentationElementInternalLayout =
  | PresentationBulletsInternalLayout
  | PresentationCardsInternalLayout;

export type PresentationBulletsInternalLayout = {
  type: "bullets";
  items: PresentationBulletItemLayout[];
  desiredHeight: number;
  usedHeight: number;
  overflow: boolean;
};

export type PresentationBulletItemLayout = {
  index: number;
  text: string;
  lineCount: number;
  itemBox: PresentationLayoutBox;
  markerBox: PresentationLayoutBox;
  textBox: PresentationLayoutBox;
};

export type PresentationCardsInternalLayout = {
  type: "cards";
  columns: number;
  rows: number;
  items: PresentationCardItemLayout[];
};

export type PresentationCardItemLayout = {
  index: number;
  title: string;
  text: string;
  cardBox: PresentationLayoutBox;
  contentBox: PresentationLayoutBox;
  titleBox: PresentationLayoutBox;
  bodyBox: PresentationLayoutBox;
  titleLineCount: number;
  bodyLineCount: number;
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
