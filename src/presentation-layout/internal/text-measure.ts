const PREVIEW_PX_PER_LAYOUT_UNIT = 84;

export function estimateTextBlock(input: {
  text: string;
  boxWidth: number;
  fontSizePt: number;
  lineHeightMultiple: number;
  minCharsPerLine?: number;
}): { lineCount: number; height: number } {
  const lineCount = estimateWrappedLineCount({
    text: input.text,
    boxWidth: input.boxWidth,
    fontSizePt: input.fontSizePt,
    minCharsPerLine: input.minCharsPerLine,
  });

  return {
    lineCount,
    height: lineCount * estimateLineHeight(input),
  };
}

export function estimateWrappedLineCount(input: {
  text: string;
  boxWidth: number;
  fontSizePt: number;
  minCharsPerLine?: number;
}): number {
  const charsPerLine = estimateCharsPerLine(input);
  const paragraphs = input.text.split(/\n+/);

  return paragraphs.reduce(
    (sum, paragraph) => sum + estimateParagraphLineCount(paragraph, charsPerLine),
    0,
  );
}

function estimateParagraphLineCount(
  text: string,
  charsPerLine: number,
): number {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 1;
  }

  let lines = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    if (word.length > charsPerLine) {
      const remainingSpace = Math.max(0, charsPerLine - currentLineLength);
      const overflowLength = Math.max(0, word.length - remainingSpace);
      const extraLines = Math.ceil(overflowLength / charsPerLine);

      lines += extraLines;
      currentLineLength = word.length % charsPerLine;
      return;
    }

    const nextLength =
      currentLineLength === 0 ? word.length : currentLineLength + 1 + word.length;

    if (nextLength <= charsPerLine) {
      currentLineLength = nextLength;
      return;
    }

    lines += 1;
    currentLineLength = word.length;
  });

  return lines;
}

function estimateCharsPerLine(input: {
  boxWidth: number;
  fontSizePt: number;
  minCharsPerLine?: number;
}): number {
  const fontSizePx = input.fontSizePt * (4 / 3);
  const averageCharWidthPx = fontSizePx * 0.58;
  const averageCharWidth = averageCharWidthPx / PREVIEW_PX_PER_LAYOUT_UNIT;

  return Math.max(
    input.minCharsPerLine ?? 12,
    Math.floor(input.boxWidth / averageCharWidth),
  );
}

function estimateLineHeight(input: {
  fontSizePt: number;
  lineHeightMultiple: number;
}): number {
  const fontSizePx = input.fontSizePt * (4 / 3);
  const lineHeightPx = fontSizePx * input.lineHeightMultiple;

  return lineHeightPx / PREVIEW_PX_PER_LAYOUT_UNIT;
}
