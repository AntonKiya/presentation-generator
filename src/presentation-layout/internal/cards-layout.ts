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

const DEFAULT_TITLE_LINE_HEIGHT = 1.14;
const DEFAULT_BODY_LINE_HEIGHT = 1.24;
const METRIC_TITLE_LINE_HEIGHT = 1.05;
const METRIC_BODY_LINE_HEIGHT = 1.2;
const MIN_DEFAULT_TITLE_FONT_SIZE = 11.5;
const MIN_DEFAULT_BODY_FONT_SIZE = 10;
const MIN_METRIC_TITLE_FONT_SIZE = 25;
const MIN_METRIC_BODY_FONT_SIZE = 10;

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
    const variant = isMetricCardTitle(item.title) ? "metric" : "default";
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const cardBox = roundBox({
      x: box.x + columnIndex * (cardWidth + gap),
      y: box.y + rowIndex * (cardHeight + gap),
      w: cardWidth,
      h: cardHeight,
    });
    const contentBox = roundBox(insetBox(cardBox, theme.spacing.cardPadding));
    const iconSize = Math.min(
      theme.spacing.cardIconSize,
      contentBox.w * 0.22,
      contentBox.h * 0.24,
    );
    const iconBox =
      variant === "default"
        ? roundBox({
            x: contentBox.x,
            y: contentBox.y,
            w: iconSize,
            h: iconSize,
          })
        : undefined;
    const textLayout = layoutCardText({
      title: item.title,
      text: item.text,
      variant,
      contentBox,
      iconBox,
      theme,
    });
    const bodyY =
      textLayout.titleBox.y + textLayout.titleBox.h + theme.spacing.cardTitleGap;
    const bodyBox = roundBox({
      x: contentBox.x,
      y: bodyY,
      w: contentBox.w,
      h: Math.max(0, contentBox.y + contentBox.h - bodyY),
    });

    return {
      index,
      variant,
      title: item.title,
      text: item.text,
      cardBox,
      contentBox,
      iconBox,
      titleBox: textLayout.titleBox,
      bodyBox,
      titleLineCount: textLayout.titleLineCount,
      bodyLineCount: textLayout.bodyLineCount,
      titleFontSize: textLayout.titleFontSize,
      titleLineHeightMultiple: textLayout.titleLineHeightMultiple,
      bodyFontSize: textLayout.bodyFontSize,
      bodyLineHeightMultiple: textLayout.bodyLineHeightMultiple,
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
        const variant = isMetricCardTitle(item.title) ? "metric" : "default";
        const iconHeight =
          variant === "default"
            ? Math.min(theme.spacing.cardIconSize, theme.spacing.cardIconSize) +
              theme.spacing.cardIconGap
            : 0;
        const title = estimateTextBlock({
          text: item.title,
          boxWidth: contentWidth,
          fontSizePt:
            variant === "metric" ? theme.typography.metric : theme.typography.cardTitle,
          lineHeightMultiple:
            variant === "metric" ? METRIC_TITLE_LINE_HEIGHT : DEFAULT_TITLE_LINE_HEIGHT,
          minCharsPerLine: variant === "metric" ? 4 : 8,
        });
        const body = estimateTextBlock({
          text: item.text,
          boxWidth: contentWidth,
          fontSizePt: theme.typography.cardBody,
          lineHeightMultiple: DEFAULT_BODY_LINE_HEIGHT,
          minCharsPerLine: 10,
        });

        return (
          theme.spacing.cardPadding * 2 +
          iconHeight +
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

function layoutCardText(input: {
  title: string;
  text: string;
  variant: PresentationCardItemLayout["variant"];
  contentBox: PresentationLayoutBox;
  iconBox?: PresentationLayoutBox;
  theme: PresentationTheme;
}): {
  titleBox: PresentationLayoutBox;
  titleLineCount: number;
  bodyLineCount: number;
  titleFontSize: number;
  titleLineHeightMultiple: number;
  bodyFontSize: number;
  bodyLineHeightMultiple: number;
} {
  const { title, text, variant, contentBox, iconBox, theme } = input;
  const titleLineHeightMultiple =
    variant === "metric" ? METRIC_TITLE_LINE_HEIGHT : DEFAULT_TITLE_LINE_HEIGHT;
  const bodyLineHeightMultiple =
    variant === "metric" ? METRIC_BODY_LINE_HEIGHT : DEFAULT_BODY_LINE_HEIGHT;
  const minTitleFontSize =
    variant === "metric" ? MIN_METRIC_TITLE_FONT_SIZE : MIN_DEFAULT_TITLE_FONT_SIZE;
  const minBodyFontSize =
    variant === "metric" ? MIN_METRIC_BODY_FONT_SIZE : MIN_DEFAULT_BODY_FONT_SIZE;
  const titleY = iconBox
    ? iconBox.y + iconBox.h + theme.spacing.cardIconGap
    : contentBox.y;
  const titleGap = theme.spacing.cardTitleGap;
  const textHeight = Math.max(0, contentBox.y + contentBox.h - titleY);
  const targetTitleFontSize: number =
    variant === "metric" ? theme.typography.metric : theme.typography.cardTitle;
  const targetBodyFontSize: number = theme.typography.cardBody;
  let titleFontSize: number = targetTitleFontSize;
  let bodyFontSize: number = targetBodyFontSize;
  let titleMeasure = measureCardTitle({
    title,
    variant,
    width: contentBox.w,
    fontSize: titleFontSize,
    lineHeightMultiple: titleLineHeightMultiple,
  });
  let bodyMeasure = measureCardBody({
    text,
    width: contentBox.w,
    fontSize: bodyFontSize,
    lineHeightMultiple: bodyLineHeightMultiple,
  });

  for (let index = 0; index < 8; index += 1) {
    const desiredHeight = titleMeasure.height + titleGap + bodyMeasure.height;

    if (desiredHeight <= textHeight || textHeight <= 0) {
      break;
    }

    const scale = Math.max(
      0.72,
      Math.min(0.96, (textHeight / desiredHeight) * 0.98),
    );
    const nextTitleFontSize = Math.max(minTitleFontSize, titleFontSize * scale);
    const nextBodyFontSize = Math.max(minBodyFontSize, bodyFontSize * scale);

    if (
      nextTitleFontSize === titleFontSize &&
      nextBodyFontSize === bodyFontSize
    ) {
      break;
    }

    titleFontSize = nextTitleFontSize;
    bodyFontSize = nextBodyFontSize;
    titleMeasure = measureCardTitle({
      title,
      variant,
      width: contentBox.w,
      fontSize: titleFontSize,
      lineHeightMultiple: titleLineHeightMultiple,
    });
    bodyMeasure = measureCardBody({
      text,
      width: contentBox.w,
      fontSize: bodyFontSize,
      lineHeightMultiple: bodyLineHeightMultiple,
    });
  }

  const maxTitleHeight =
    variant === "metric"
      ? Math.max(0, textHeight * 0.62)
      : Math.max(0, textHeight * 0.48);
  const titleHeight = round(Math.min(titleMeasure.height, maxTitleHeight));

  return {
    titleBox: roundBox({
      x: contentBox.x,
      y: titleY,
      w: contentBox.w,
      h: titleHeight,
    }),
    titleLineCount: titleMeasure.lineCount,
    bodyLineCount: bodyMeasure.lineCount,
    titleFontSize: round(titleFontSize),
    titleLineHeightMultiple,
    bodyFontSize: round(bodyFontSize),
    bodyLineHeightMultiple,
  };
}

function measureCardTitle(input: {
  title: string;
  variant: PresentationCardItemLayout["variant"];
  width: number;
  fontSize: number;
  lineHeightMultiple: number;
}): { height: number; lineCount: number } {
  return estimateTextBlock({
    text: input.title,
    boxWidth: input.width,
    fontSizePt: input.fontSize,
    lineHeightMultiple: input.lineHeightMultiple,
    minCharsPerLine: input.variant === "metric" ? 4 : 8,
  });
}

function measureCardBody(input: {
  text: string;
  width: number;
  fontSize: number;
  lineHeightMultiple: number;
}): { height: number; lineCount: number } {
  return estimateTextBlock({
    text: input.text,
    boxWidth: input.width,
    fontSizePt: input.fontSize,
    lineHeightMultiple: input.lineHeightMultiple,
    minCharsPerLine: 10,
  });
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

function isMetricCardTitle(title: string): boolean {
  return /(?:^|\s)[+-]?\d+(?:[.,]\d+)?\s*(?:%|x|×|млн|млрд|трлн|k|m|b)?(?:\s|$)/i.test(
    title,
  );
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
