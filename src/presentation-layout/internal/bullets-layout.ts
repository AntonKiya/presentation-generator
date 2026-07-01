import type { Element } from "../../presentation-generation/schemas/element-schema";
import type { PresentationTheme } from "../../presentation-theme";
import type {
  PresentationBulletItemLayout,
  PresentationBulletsInternalLayout,
  PresentationLayoutBox,
  PresentationLayoutNode,
} from "../presentation-layout.types";
import { estimateTextBlock } from "./text-measure";

type BulletsElement = Extract<Element, { type: "bullets" }>;

const TEXT_LINE_HEIGHT_MULTIPLE = 1.36;
const MARKER_FONT_SIZE_MULTIPLE = 1.45;

export function layoutBulletsElement(input: {
  element: BulletsElement;
  box: PresentationLayoutBox;
  theme: PresentationTheme;
}): PresentationBulletsInternalLayout {
  const { element, box, theme } = input;
  const measurement = measureBulletsElement({
    element,
    boxWidth: box.w,
    theme,
  });
  const markerWidth = theme.spacing.bulletMarkerWidth;
  const markerHeight = theme.spacing.bulletMarkerHeight;
  const textGap = theme.spacing.bulletTextGap;
  const gap = theme.spacing.bulletGap;
  const textX = box.x + markerWidth + textGap;
  const textWidth = measurement.textWidth;
  const desiredHeight = measurement.desiredHeight;
  const overflow = desiredHeight > box.h && box.h > 0;
  const scale = overflow ? box.h / desiredHeight : 1;
  const textFontSize = theme.typography.bullets * scale;
  const markerFontSize = theme.typography.bullets * MARKER_FONT_SIZE_MULTIPLE * scale;
  const effectiveGap = gap * scale;
  let y = box.y;

  const items: PresentationBulletItemLayout[] = element.items.map((item, index) => {
    const measuredItem = measurement.items[index];
    const itemHeight = (measuredItem?.height ?? 0) * scale;
    const firstLineHeight = (measurement.lineHeight || itemHeight) * scale;
    const effectiveMarkerHeight = Math.min(markerHeight * scale, firstLineHeight);
    const itemBox = roundBox({
      x: box.x,
      y,
      w: box.w,
      h: itemHeight,
    });
    const markerBox = roundBox({
      x: box.x,
      y: y + Math.max(0, (firstLineHeight - effectiveMarkerHeight) / 2),
      w: markerWidth,
      h: effectiveMarkerHeight,
    });
    const textBox = roundBox({
      x: textX,
      y,
      w: textWidth,
      h: itemHeight,
    });

    y += itemHeight + effectiveGap;

    return {
      index,
      text: item,
      lineCount: measuredItem?.lineCount ?? 1,
      textFontSize: round(textFontSize),
      textLineHeightMultiple: TEXT_LINE_HEIGHT_MULTIPLE,
      markerFontSize: round(markerFontSize),
      itemBox,
      markerBox,
      textBox,
    };
  });

  return {
    type: "bullets",
    items,
    desiredHeight: round(desiredHeight),
    usedHeight: round(Math.min(desiredHeight, box.h)),
    overflow,
  };
}

export function estimateBulletsDesiredHeight(input: {
  element: BulletsElement;
  boxWidth: number;
  theme: PresentationTheme;
}): number {
  return measureBulletsElement(input).desiredHeight;
}

export function getBulletsInternalLayout(
  layoutNode: PresentationLayoutNode,
): PresentationBulletsInternalLayout | undefined {
  return layoutNode.internal?.type === "bullets" ? layoutNode.internal : undefined;
}

function measureBulletsElement(input: {
  element: BulletsElement;
  boxWidth: number;
  theme: PresentationTheme;
}): {
  textWidth: number;
  lineHeight: number;
  desiredHeight: number;
  items: Array<{ height: number; lineCount: number }>;
} {
  const { element, boxWidth, theme } = input;
  const textWidth = Math.max(
    0.1,
    boxWidth - theme.spacing.bulletMarkerWidth - theme.spacing.bulletTextGap,
  );
  const items = element.items.map((item) => {
    const measuredText = estimateTextBlock({
      text: item,
      boxWidth: textWidth,
      fontSizePt: theme.typography.bullets,
      lineHeightMultiple: TEXT_LINE_HEIGHT_MULTIPLE,
      minCharsPerLine: 12,
    });

    return {
      lineCount: measuredText.lineCount,
      height: measuredText.height,
    };
  });
  const desiredHeight =
    items.reduce((sum, item) => sum + item.height, 0) +
    theme.spacing.bulletGap * Math.max(0, element.items.length - 1);

  return {
    textWidth,
    lineHeight:
      items.length > 0
        ? round(items[0].height / Math.max(1, items[0].lineCount))
        : 0,
    desiredHeight: round(desiredHeight),
    items,
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
