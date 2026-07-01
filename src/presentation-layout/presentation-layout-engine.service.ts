import { Injectable } from "@nestjs/common";
import type {
  LayoutChild,
  LayoutContainer,
} from "../presentation-generation/schemas/container-schema";
import type { Element } from "../presentation-generation/schemas/element-schema";
import type { Presentation } from "../presentation-generation/schemas/presentation-schema";
import type { Slide } from "../presentation-generation/schemas/slide-schema";
import { PRESENTATION_DEFAULT_THEME } from "../presentation-theme";
import {
  estimateBulletsDesiredHeight,
  estimateCardsDesiredHeight,
  layoutBulletsElement,
  layoutCardsElement,
} from "./internal";
import {
  getPresentationLayoutSlideSize,
  PRESENTATION_LAYOUT_ELEMENT_HEIGHTS,
  PRESENTATION_LAYOUT_LIMITS,
  PRESENTATION_LAYOUT_REFERENCE,
  resolvePresentationLayoutOptions,
  type PresentationLayoutOptions,
} from "./presentation-layout.constants";
import type {
  PresentationLayout,
  PresentationLayoutBox,
  PresentationElementInternalLayout,
  PresentationLayoutIssue,
  PresentationLayoutNode,
  PresentationSlideLayout,
} from "./presentation-layout.types";

@Injectable()
export class PresentationLayoutEngineService {
  layoutPresentation(
    presentation: Presentation,
    options?: Partial<PresentationLayoutOptions>,
  ): PresentationLayout {
    const resolvedOptions = resolvePresentationLayoutOptions(options);
    const slideSize = getPresentationLayoutSlideSize(resolvedOptions.slideSize);
    const slideBox = roundBox({
      x: 0,
      y: 0,
      w: slideSize.width,
      h: slideSize.height,
    });
    const slides = presentation.slides.map((slide, slideIndex) =>
      this.layoutSlide(slide, slideIndex, resolvedOptions),
    );

    return {
      presentationId: presentation.id,
      slideSize: resolvedOptions.slideSize,
      slideBox,
      slides,
      issues: slides.flatMap((slide) => slide.issues),
    };
  }

  layoutSlide(
    slide: Slide,
    slideIndex = 0,
    options?: Partial<PresentationLayoutOptions>,
  ): PresentationSlideLayout {
    const resolvedOptions = resolvePresentationLayoutOptions(options);
    const size = getPresentationLayoutSlideSize(resolvedOptions.slideSize);
    const slideBox = roundBox({ x: 0, y: 0, w: size.width, h: size.height });
    const safeArea = pixelsToLayoutUnits(
      PRESENTATION_LAYOUT_REFERENCE.safeAreaPx,
      size.width,
    );
    const contentBox = roundBox(insetBox(slideBox, safeArea));
    const issues: PresentationLayoutIssue[] = [];
    const root = this.layoutContainer({
      container: slide.root_container,
      slide,
      path: "root_container",
      box: contentBox,
      issues,
      slideWidth: size.width,
    });

    return {
      slideId: slide.id,
      slideIndex,
      slideSize: resolvedOptions.slideSize,
      slideBox,
      contentBox,
      root,
      issues,
    };
  }

  private layoutContainer(input: {
    container: LayoutContainer;
    slide: Slide;
    path: string;
    box: PresentationLayoutBox;
    issues: PresentationLayoutIssue[];
    slideWidth: number;
  }): PresentationLayoutNode {
    const { container, slide, path, box, issues, slideWidth } = input;
    const roundedBox = roundBox(box);

    checkBoxSize({
      box: roundedBox,
      slide,
      nodeId: getContainerNodeId(container, path),
      path,
      issues,
    });

    const innerBox = roundBox(
      insetBox(
        roundedBox,
        pixelsToLayoutUnits(container.padding ?? 0, slideWidth),
      ),
    );
    const children = layoutContainerChildren({
      container,
      slide,
      path,
      box: innerBox,
      issues,
      slideWidth,
      layoutNode: (child, childPath, childBox) =>
        this.layoutChild({
          child,
          slide,
          path: childPath,
          box: childBox,
          issues,
          slideWidth,
        }),
    });

    return {
      nodeId: getContainerNodeId(container, path),
      nodeType: "container",
      dslType: container.type,
      path,
      box: roundedBox,
      children,
    };
  }

  private layoutChild(input: {
    child: LayoutChild;
    slide: Slide;
    path: string;
    box: PresentationLayoutBox;
    issues: PresentationLayoutIssue[];
    slideWidth: number;
  }): PresentationLayoutNode {
    const { child, slide, path, box, issues, slideWidth } = input;

    if (isLayoutContainer(child)) {
      return this.layoutContainer({
        container: child,
        slide,
        path,
        box,
        issues,
        slideWidth,
      });
    }

    const element = child as Element;
    const roundedBox = roundBox(box);
    const internal = layoutElementInternal(element, roundedBox);

    checkBoxSize({
      box: roundedBox,
      slide,
      nodeId: element.id,
      path,
      issues,
    });

    if (internal?.type === "bullets" && internal.overflow) {
      issues.push({
        severity: "warning",
        code: "BULLETS_MAY_OVERFLOW",
        message:
          "Bullets content exceeds its layout box and was fit into the available space.",
        slideId: slide.id,
        nodeId: element.id,
        path,
      });
    }

    return {
      nodeId: element.id,
      nodeType: "element",
      dslType: element.type,
      path,
      box: roundedBox,
      internal,
    };
  }
}

function layoutElementInternal(
  element: Element,
  box: PresentationLayoutBox,
): PresentationElementInternalLayout | undefined {
  if (element.type === "bullets") {
    return layoutBulletsElement({
      element,
      box,
      theme: PRESENTATION_DEFAULT_THEME,
    });
  }

  if (element.type === "cards") {
    return layoutCardsElement({
      element,
      box,
      theme: PRESENTATION_DEFAULT_THEME,
    });
  }

  return undefined;
}

function layoutContainerChildren(input: {
  container: LayoutContainer;
  slide: Slide;
  path: string;
  box: PresentationLayoutBox;
  issues: PresentationLayoutIssue[];
  slideWidth: number;
  layoutNode: (
    child: LayoutChild,
    childPath: string,
    childBox: PresentationLayoutBox,
  ) => PresentationLayoutNode;
}): PresentationLayoutNode[] {
  const { container } = input;

  if (container.children.length === 0) {
    return [];
  }

  switch (container.type) {
    case "stack":
      return layoutStackChildren(input);
    case "row":
      return layoutRowChildren(input);
    case "grid":
      return layoutGridChildren(input);
    default:
      return [];
  }
}

function layoutStackChildren(input: {
  container: LayoutContainer;
  path: string;
  box: PresentationLayoutBox;
  slideWidth: number;
  layoutNode: (
    child: LayoutChild,
    childPath: string,
    childBox: PresentationLayoutBox,
  ) => PresentationLayoutNode;
}): PresentationLayoutNode[] {
  const { container, path, box, slideWidth, layoutNode } = input;
  const children = container.children as LayoutChild[];
  const gap = pixelsToLayoutUnits(container.gap ?? 0, slideWidth);
  const availableHeight = Math.max(0, box.h - gap * (children.length - 1));
  const preferredHeights = children.map((child: LayoutChild) =>
    estimatePreferredHeight(child, slideWidth, box.w),
  );
  const growWeights = children.map(getGrowWeight);
  const heights = fitSizes(preferredHeights, growWeights, availableHeight);
  let y = box.y;

  return children.map((child: LayoutChild, index: number) => {
    const childBox = {
      x: box.x,
      y,
      w: box.w,
      h: heights[index] ?? 0,
    };

    y += childBox.h + gap;

    return layoutNode(child, `${path}.children[${index}]`, childBox);
  });
}

function layoutRowChildren(input: {
  container: LayoutContainer;
  path: string;
  box: PresentationLayoutBox;
  slideWidth: number;
  layoutNode: (
    child: LayoutChild,
    childPath: string,
    childBox: PresentationLayoutBox,
  ) => PresentationLayoutNode;
}): PresentationLayoutNode[] {
  const { container, path, box, slideWidth, layoutNode } = input;
  const children = container.children as LayoutChild[];
  const gap = pixelsToLayoutUnits(container.gap ?? 0, slideWidth);
  const availableWidth = Math.max(0, box.w - gap * (children.length - 1));
  const widths = resolveRowWidths(children, availableWidth);
  let x = box.x;

  return children.map((child: LayoutChild, index: number) => {
    const childBox = {
      x,
      y: box.y,
      w: widths[index] ?? 0,
      h: box.h,
    };

    x += childBox.w + gap;

    return layoutNode(child, `${path}.children[${index}]`, childBox);
  });
}

function layoutGridChildren(input: {
  container: Extract<LayoutContainer, { type: "grid" }>;
  path: string;
  box: PresentationLayoutBox;
  slideWidth: number;
  layoutNode: (
    child: LayoutChild,
    childPath: string,
    childBox: PresentationLayoutBox,
  ) => PresentationLayoutNode;
}): PresentationLayoutNode[] {
  const { container, path, box, slideWidth, layoutNode } = input;
  const children = container.children as LayoutChild[];
  const gap = pixelsToLayoutUnits(container.gap ?? 0, slideWidth);
  const columns = resolveGridColumns(container.columns, children.length);
  const rows = Math.ceil(children.length / columns);
  const cellWidth = Math.max(0, (box.w - gap * (columns - 1)) / columns);
  const cellHeight = Math.max(0, (box.h - gap * (rows - 1)) / rows);

  return children.map((child: LayoutChild, index: number) => {
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const childBox = {
      x: box.x + columnIndex * (cellWidth + gap),
      y: box.y + rowIndex * (cellHeight + gap),
      w: cellWidth,
      h: cellHeight,
    };

    return layoutNode(child, `${path}.children[${index}]`, childBox);
  });
}

function resolveRowWidths(
  children: LayoutChild[],
  availableWidth: number,
): number[] {
  if (children.length === 0) {
    return [];
  }

  const explicitWidths = children.map((child) =>
    isLayoutContainer(child) && typeof child.width === "number"
      ? child.width
      : undefined,
  );
  const explicitTotal = explicitWidths.reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const missingCount = explicitWidths.filter((value) => value === undefined).length;

  if (explicitTotal === 0) {
    return children.map(() => availableWidth / children.length);
  }

  if (missingCount === 0) {
    return explicitWidths.map(
      (value) => availableWidth * ((value ?? 0) / explicitTotal),
    );
  }

  if (explicitTotal < 1) {
    const missingWidth = (1 - explicitTotal) / missingCount;

    return explicitWidths.map((value) => availableWidth * (value ?? missingWidth));
  }

  const fallbackWeights = explicitWidths.map((value) => value ?? 1);
  const totalWeight = fallbackWeights.reduce((sum, value) => sum + value, 0);

  return fallbackWeights.map((value) => availableWidth * (value / totalWeight));
}

export function resolveGridColumns(
  columns: number | "auto",
  childCount: number,
): number {
  if (childCount <= 0) {
    return 1;
  }

  if (typeof columns === "number") {
    return Math.max(1, Math.min(columns, childCount));
  }

  if (childCount <= 2) {
    return childCount;
  }

  if (childCount <= 4) {
    return 2;
  }

  if (childCount <= 6) {
    return 3;
  }

  return PRESENTATION_LAYOUT_LIMITS.maxAutoGridColumns;
}

// The layout pass must decide stable boxes before either renderer knows exact
// browser or PowerPoint text metrics. These estimates are shared renderer
// heuristics, not new DSL semantics.
function fitSizes(
  preferredSizes: number[],
  growWeights: number[],
  availableSize: number,
): number[] {
  if (preferredSizes.length === 0) {
    return [];
  }

  if (availableSize <= 0) {
    return preferredSizes.map(() => 0);
  }

  const preferredTotal = preferredSizes.reduce((sum, size) => sum + size, 0);

  if (preferredTotal <= 0) {
    return preferredSizes.map(() => availableSize / preferredSizes.length);
  }

  if (preferredTotal > availableSize) {
    const scale = availableSize / preferredTotal;

    return preferredSizes.map((size) => size * scale);
  }

  const sizes = [...preferredSizes];
  const extra = availableSize - preferredTotal;
  const growTotal = growWeights.reduce((sum, weight) => sum + weight, 0);

  if (growTotal <= 0) {
    const extraPerChild = extra / sizes.length;

    return sizes.map((size) => size + extraPerChild);
  }

  return sizes.map((size, index) => size + extra * (growWeights[index] / growTotal));
}

function estimatePreferredHeight(
  child: LayoutChild,
  slideWidth: number,
  availableWidth: number,
): number {
  if (isLayoutContainer(child)) {
    const children = child.children as LayoutChild[];
    const gap = pixelsToLayoutUnits(child.gap ?? 0, slideWidth);
    const padding = pixelsToLayoutUnits(child.padding ?? 0, slideWidth) * 2;
    const innerWidth = Math.max(0, availableWidth - padding);

    if (children.length === 0) {
      return padding + PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.textMin;
    }

    if (child.type === "row") {
      const availableInnerWidth = Math.max(
        0,
        innerWidth - gap * (children.length - 1),
      );
      const widths = resolveRowWidths(children, availableInnerWidth);

      return Math.max(
        2.1,
        Math.max(
          ...children.map((nestedChild: LayoutChild, index: number) =>
            estimatePreferredHeight(nestedChild, slideWidth, widths[index] ?? 0),
          ),
        ) + padding,
      );
    }

    if (child.type === "grid") {
      const columns = resolveGridColumns(child.columns, children.length);
      const rows = Math.ceil(children.length / columns);
      const cellWidth = Math.max(
        0,
        (innerWidth - gap * (columns - 1)) / columns,
      );
      const rowHeights = Array.from({ length: rows }, (_, rowIndex) => {
        const rowChildren = children.slice(
          rowIndex * columns,
          rowIndex * columns + columns,
        );

        return Math.max(
          ...rowChildren.map((nestedChild: LayoutChild) =>
            estimatePreferredHeight(nestedChild, slideWidth, cellWidth),
          ),
        );
      });

      return Math.max(
        2.1,
        padding +
          rowHeights.reduce((sum, height) => sum + height, 0) +
          gap * Math.max(0, rows - 1),
      );
    }

    const childrenHeight = children.reduce(
      (sum: number, nestedChild: LayoutChild) =>
        sum + estimatePreferredHeight(nestedChild, slideWidth, innerWidth),
      0,
    );

    return padding + childrenHeight + gap * (children.length - 1);
  }

  return estimateElementPreferredHeight(child as Element, availableWidth);
}

function estimateElementPreferredHeight(
  element: Element,
  availableWidth: number,
): number {
  switch (element.type) {
    case "title":
      return PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.title;
    case "subtitle":
      return PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.subtitle;
    case "text":
      return Math.max(
        PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.textMin,
        Math.ceil(
          element.text.length / PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.textCharsPerLine,
        ) * PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.textLineHeight,
      );
    case "bullets":
      return Math.max(
        PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.bulletsBase +
          element.items.length * PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.bulletItemHeight,
        estimateBulletsDesiredHeight({
          element,
          boxWidth: availableWidth,
          theme: PRESENTATION_DEFAULT_THEME,
        }),
      );
    case "image":
      return PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.image;
    case "cards":
      return Math.max(
        PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.cardsBase +
          Math.ceil(element.items.length / 2) *
            PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.cardItemHeight,
        estimateCardsDesiredHeight({
          element,
          boxWidth: availableWidth,
          theme: PRESENTATION_DEFAULT_THEME,
        }),
      );
    case "table":
      return (
        PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.tableHeaderHeight +
        element.rows.length * PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.tableRowHeight
      );
    case "chart":
      return PRESENTATION_LAYOUT_ELEMENT_HEIGHTS.chart;
  }
}

function getGrowWeight(child: LayoutChild): number {
  if (isLayoutContainer(child)) {
    const children = child.children as LayoutChild[];

    if (child.slot === "title" || child.slot === "footer") {
      return 0;
    }

    if (
      child.slot === "body" ||
      child.slot === "visual" ||
      child.slot === "data" ||
      child.slot === "comment" ||
      child.type === "row" ||
      child.type === "grid"
    ) {
      return 1;
    }

    return children.some((nestedChild: LayoutChild) => getGrowWeight(nestedChild) > 0)
      ? 1
      : 0;
  }

  const element = child as Element;

  if (element.type === "title" || element.type === "subtitle") {
    return 0;
  }

  return 1;
}

function checkBoxSize(input: {
  box: PresentationLayoutBox;
  slide: Slide;
  nodeId: string;
  path: string;
  issues: PresentationLayoutIssue[];
}): void {
  const { box, slide, nodeId, path, issues } = input;

  if (
    box.w >= PRESENTATION_LAYOUT_LIMITS.minRenderableWidth &&
    box.h >= PRESENTATION_LAYOUT_LIMITS.minRenderableHeight
  ) {
    return;
  }

  issues.push({
    severity: "warning",
    code: "BOX_TOO_SMALL",
    message: `Layout box ${box.w}x${box.h} may be too small for stable rendering.`,
    slideId: slide.id,
    nodeId,
    path,
  });
}

// Templates store gap/padding in preview pixels. Layout uses a stable wide-slide
// coordinate system and each renderer maps those units to its native output.
export function pixelsToLayoutUnits(px: number, slideWidth: number): number {
  return px * (slideWidth / PRESENTATION_LAYOUT_REFERENCE.previewWidthPx);
}

export function layoutUnitsToPreviewPx(
  units: number,
  slideWidth: number,
): number {
  return units * (PRESENTATION_LAYOUT_REFERENCE.previewWidthPx / slideWidth);
}

function insetBox(
  box: PresentationLayoutBox,
  inset: number,
): PresentationLayoutBox {
  return {
    x: box.x + inset,
    y: box.y + inset,
    w: Math.max(0, box.w - inset * 2),
    h: Math.max(0, box.h - inset * 2),
  };
}

function roundBox(box: PresentationLayoutBox): PresentationLayoutBox {
  return {
    x: round(box.x),
    y: round(box.y),
    w: round(box.w),
    h: round(box.h),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getContainerNodeId(container: LayoutContainer, path: string): string {
  return container.id ?? path;
}

function isLayoutContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}
