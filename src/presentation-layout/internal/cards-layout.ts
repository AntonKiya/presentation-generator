import type { Element } from "../../presentation-generation/schemas/element-schema";
import type { PresentationTheme } from "../../presentation-theme";
import type {
  PresentationCardItemLayout,
  PresentationCardsInternalLayout,
  PresentationLayoutBox,
  PresentationLayoutNode,
} from "../presentation-layout.types";
import { estimateTextBlock } from "./text-measure";

type CardsElement = Extract<Element, { type: "cards" }>;

export function layoutCardsElement(input: {
  element: CardsElement;
  box: PresentationLayoutBox;
  theme: PresentationTheme;
}): PresentationCardsInternalLayout {
  const { element, box, theme } = input;
  const columns = resolveCardsColumns(element.items.length);
  const rows = Math.ceil(element.items.length / columns);
  const gap = theme.spacing.cardGap;
  const cardWidth = Math.max(0, (box.w - gap * (columns - 1)) / columns);
  const cardHeight = Math.max(0, (box.h - gap * (rows - 1)) / rows);
  const items = element.items.map((item, index): PresentationCardItemLayout => {
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const cardBox = roundBox({
      x: box.x + columnIndex * (cardWidth + gap),
      y: box.y + rowIndex * (cardHeight + gap),
      w: cardWidth,
      h: cardHeight,
    });
    const contentBox = roundBox(insetBox(cardBox, theme.spacing.cardPadding));
    const titleMeasure = estimateTextBlock({
      text: item.title,
      boxWidth: contentBox.w,
      fontSizePt: theme.typography.cardTitle,
      lineHeightMultiple: 1.16,
      minCharsPerLine: 8,
    });
    const titleHeight = round(
      Math.min(Math.max(titleMeasure.height, 0.18), contentBox.h * 0.42),
    );
    const bodyY = contentBox.y + titleHeight + theme.spacing.cardTitleGap;
    const bodyBox = roundBox({
      x: contentBox.x,
      y: bodyY,
      w: contentBox.w,
      h: Math.max(0, contentBox.y + contentBox.h - bodyY),
    });

    return {
      index,
      title: item.title,
      text: item.text,
      cardBox,
      contentBox,
      titleBox: roundBox({
        x: contentBox.x,
        y: contentBox.y,
        w: contentBox.w,
        h: titleHeight,
      }),
      bodyBox,
      titleLineCount: titleMeasure.lineCount,
      bodyLineCount: estimateTextBlock({
        text: item.text,
        boxWidth: bodyBox.w,
        fontSizePt: theme.typography.cardBody,
        lineHeightMultiple: 1.24,
        minCharsPerLine: 10,
      }).lineCount,
    };
  });

  return {
    type: "cards",
    columns,
    rows,
    items,
  };
}

export function estimateCardsDesiredHeight(input: {
  element: CardsElement;
  boxWidth: number;
  theme: PresentationTheme;
}): number {
  const { element, boxWidth, theme } = input;
  const columns = resolveCardsColumns(element.items.length);
  const rows = Math.ceil(element.items.length / columns);
  const gap = theme.spacing.cardGap;
  const cardWidth = Math.max(0.1, (boxWidth - gap * (columns - 1)) / columns);
  const contentWidth = Math.max(0.1, cardWidth - theme.spacing.cardPadding * 2);
  const rowHeights = Array.from({ length: rows }, (_, rowIndex) => {
    const rowItems = element.items.slice(
      rowIndex * columns,
      rowIndex * columns + columns,
    );

    return Math.max(
      0,
      ...rowItems.map((item) => {
        const title = estimateTextBlock({
          text: item.title,
          boxWidth: contentWidth,
          fontSizePt: theme.typography.cardTitle,
          lineHeightMultiple: 1.16,
          minCharsPerLine: 8,
        });
        const body = estimateTextBlock({
          text: item.text,
          boxWidth: contentWidth,
          fontSizePt: theme.typography.cardBody,
          lineHeightMultiple: 1.24,
          minCharsPerLine: 10,
        });

        return (
          theme.spacing.cardPadding * 2 +
          title.height +
          theme.spacing.cardTitleGap +
          body.height
        );
      }),
    );
  });

  return round(
    rowHeights.reduce((sum, height) => sum + height, 0) +
      gap * Math.max(0, rows - 1),
  );
}

export function getCardsInternalLayout(
  layoutNode: PresentationLayoutNode,
): PresentationCardsInternalLayout | undefined {
  return layoutNode.internal?.type === "cards" ? layoutNode.internal : undefined;
}

export function resolveCardsColumns(itemsCount: number): number {
  if (itemsCount <= 2) {
    return Math.max(1, itemsCount);
  }

  if (itemsCount <= 4) {
    return 2;
  }

  return 3;
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
