import type { Presentation } from "../../presentation-generation/schemas/presentation-schema";
import {
  createAllElementsPresentation,
  createContentSlide,
  createDataFocusChartSlide,
} from "../../presentation-generation/__tests__/fixtures";
import {
  PPTX_EXPORT_SLIDE_SIZES,
  PptxExportService,
  PptxLayoutEngineService,
  resolveGridColumns,
} from "../pptx";
import { PRESENTATION_DEFAULT_THEME } from "../../presentation-theme";
import { PptxExportPreflightService } from "../pptx/preflight";
import { PptxRendererService } from "../pptx/render";
import { PptxGenJsAdapter } from "../pptx/writer";

function createService(): PptxExportService {
  const adapter = new PptxGenJsAdapter();

  return new PptxExportService(
    new PptxExportPreflightService(),
    new PptxLayoutEngineService(),
    new PptxRendererService(adapter),
    adapter,
  );
}

describe("PPTX layout engine", () => {
  it("layouts a presentation inside the deterministic wide safe area", () => {
    const engine = new PptxLayoutEngineService();
    const presentation: Presentation = {
      id: "presentation_layout",
      type: "presentation",
      slides: [createContentSlide()],
    };

    const layout = engine.layoutPresentation(presentation);
    const slide = layout.slides[0];

    expect(layout.presentationId).toBe("presentation_layout");
    expect(layout.slideSize).toBe("wide-16-9");
    expect(layout.slideBox).toEqual({
      x: 0,
      y: 0,
      w: PPTX_EXPORT_SLIDE_SIZES["wide-16-9"].width,
      h: PPTX_EXPORT_SLIDE_SIZES["wide-16-9"].height,
    });
    expect(slide.contentBox.x).toBeGreaterThan(0);
    expect(slide.contentBox.y).toBeGreaterThan(0);
    expect(slide.root.box).toEqual(slide.contentBox);
    expect(slide.root.children).toHaveLength(2);
    expect(layout.issues).toEqual([]);
  });

  it("keeps title containers compact and gives body containers remaining stack height", () => {
    const engine = new PptxLayoutEngineService();
    const slide = engine.layoutSlide(createContentSlide());
    const [titleContainer, bodyContainer] = slide.root.children ?? [];

    expect(titleContainer.dslType).toBe("stack");
    expect(bodyContainer.dslType).toBe("stack");
    expect(titleContainer.box.h).toBeLessThan(bodyContainer.box.h);
    expect(bodyContainer.box.y).toBeGreaterThan(titleContainer.box.y);
  });

  it("respects row child width fractions after subtracting gap", () => {
    const engine = new PptxLayoutEngineService();
    const slide = engine.layoutSlide(createDataFocusChartSlide());
    const row = slide.root.children?.[1];
    const [dataColumn, commentColumn] = row?.children ?? [];

    expect(row?.dslType).toBe("row");
    expect(dataColumn.box.w).toBeGreaterThan(commentColumn.box.w);
    expect(dataColumn.box.w / (dataColumn.box.w + commentColumn.box.w)).toBeCloseTo(
      0.65,
      1,
    );
    expect(commentColumn.box.x).toBeGreaterThan(dataColumn.box.x);
  });

  it("resolves auto grid columns deterministically", () => {
    expect(resolveGridColumns("auto", 1)).toBe(1);
    expect(resolveGridColumns("auto", 3)).toBe(2);
    expect(resolveGridColumns("auto", 5)).toBe(3);
    expect(resolveGridColumns("auto", 8)).toBe(4);
    expect(resolveGridColumns(4, 2)).toBe(2);
  });

  it("lays grid children in row-major cells", () => {
    const engine = new PptxLayoutEngineService();
    const presentation = createAllElementsPresentation();
    const slide = presentation.slides[0];

    slide.root_container = {
      type: "grid",
      columns: "auto",
      gap: 16,
      children: [
        { id: "one", type: "text", text: "One" },
        { id: "two", type: "text", text: "Two" },
        { id: "three", type: "text", text: "Three" },
        { id: "four", type: "text", text: "Four" },
      ],
    };

    const layout = engine.layoutSlide(slide);
    const [one, two, three, four] = layout.root.children ?? [];

    expect(one.box.y).toBeCloseTo(two.box.y);
    expect(three.box.y).toBeGreaterThan(one.box.y);
    expect(two.box.x).toBeGreaterThan(one.box.x);
    expect(four.box.x).toBeGreaterThan(three.box.x);
  });

  it("creates non-overlapping internal bullet item boxes for wrapped text", () => {
    const engine = new PptxLayoutEngineService();
    const slide = createContentSlide();

    slide.root_container = {
      type: "stack",
      gap: 18,
      children: [
        {
          type: "stack",
          slot: "title",
          accepts: ["title"],
          required: true,
          children: [
            {
              id: "wrapped_bullets_title",
              type: "title",
              text: "Wrapped bullets",
            },
          ],
        },
        {
          id: "wrapped_bullets",
          type: "bullets",
          items: [
            "This is a deliberately long bullet item that should wrap to multiple lines inside the available text box.",
            "A second long bullet item verifies that wrapped text receives its own vertical area and cannot overlap the previous item.",
            "A short final item.",
          ],
        },
      ],
    };

    const layout = engine.layoutSlide(slide);
    const bulletsNode = layout.root.children?.[1];
    const internalLayout =
      bulletsNode?.internal?.type === "bullets" ? bulletsNode.internal : undefined;

    expect(internalLayout).toBeDefined();
    expect(internalLayout?.items).toHaveLength(3);

    const items = internalLayout?.items ?? [];

    items.slice(1).forEach((item, index) => {
      const previousItem = items[index];

      expect(item.itemBox.y).toBeGreaterThanOrEqual(
        previousItem.itemBox.y + previousItem.itemBox.h,
      );
    });
    items.forEach((item) => {
      expect(item.textBox.x).toBeGreaterThan(item.markerBox.x);
      expect(item.textBox.h).toBe(item.itemBox.h);
      expect(item.markerBox.y).toBeLessThanOrEqual(item.textBox.y + 0.02);
      expect(item.textFontSize).toBeGreaterThan(0);
      expect(item.markerFontSize).toBeGreaterThan(item.textFontSize);
    });
    expect(internalLayout?.usedHeight).toBeLessThanOrEqual(
      bulletsNode?.box.h ?? Number.POSITIVE_INFINITY,
    );
  });

  it("creates internal card boxes with title and body areas", () => {
    const engine = new PptxLayoutEngineService();
    const slide = createContentSlide();

    slide.root_container = {
      type: "stack",
      gap: 18,
      children: [
        {
          type: "stack",
          slot: "title",
          accepts: ["title"],
          required: true,
          children: [
            {
              id: "cards_title",
              type: "title",
              text: "Cards",
            },
          ],
        },
        {
          id: "cards",
          type: "cards",
          items: [
            { title: "First card", text: "A larger readable body." },
            { title: "Second card", text: "Another readable body." },
            { title: "Third card", text: "A final readable body." },
          ],
        },
      ],
    };

    const layout = engine.layoutSlide(slide);
    const cardsNode = layout.root.children?.[1];
    const internalLayout =
      cardsNode?.internal?.type === "cards" ? cardsNode.internal : undefined;

    expect(internalLayout).toBeDefined();
    expect(internalLayout?.columns).toBe(2);
    expect(internalLayout?.rows).toBe(2);
    expect(internalLayout?.items).toHaveLength(3);

    internalLayout?.items.forEach((item) => {
      expect(item.cardBox.x).toBeGreaterThanOrEqual(cardsNode?.box.x ?? 0);
      expect(item.cardBox.y).toBeGreaterThanOrEqual(cardsNode?.box.y ?? 0);
      expect(item.titleBox.x).toBeGreaterThan(item.cardBox.x);
      expect(item.bodyBox.y).toBeGreaterThan(item.titleBox.y);
      expect(item.bodyBox.y + item.bodyBox.h).toBeLessThanOrEqual(
        item.cardBox.y + item.cardBox.h,
      );
      expect(item.titleFontSize).toBeGreaterThan(0);
      expect(item.bodyFontSize).toBeGreaterThan(0);
    });
  });

  it("fits long card text by reducing card typography inside the fixed card box", () => {
    const engine = new PptxLayoutEngineService();
    const slide = createContentSlide();

    slide.root_container = {
      type: "stack",
      gap: 18,
      children: [
        {
          type: "stack",
          slot: "title",
          accepts: ["title"],
          required: true,
          children: [{ id: "long_cards_title", type: "title", text: "Long cards" }],
        },
        {
          id: "long_cards",
          type: "cards",
          items: [
            {
              title: "A deliberately verbose card title",
              text: "This body text is intentionally long so the shared layout engine has to fit typography inside the card instead of letting renderer-specific overflow leak outside the panel.",
            },
            {
              title: "Second verbose card title",
              text: "Another long body verifies that title and body areas stay inside the same card bounds and keep deterministic geometry for HTML and PPTX.",
            },
            {
              title: "Third verbose card title",
              text: "The final card repeats the same pressure with enough content to force the card typography fitting path.",
            },
          ],
        },
      ],
    };

    const layout = engine.layoutSlide(slide);
    const cardsNode = layout.root.children?.[1];
    const internalLayout =
      cardsNode?.internal?.type === "cards" ? cardsNode.internal : undefined;

    expect(internalLayout).toBeDefined();
    internalLayout?.items.forEach((item) => {
      expect(item.titleBox.y + item.titleBox.h).toBeLessThanOrEqual(
        item.cardBox.y + item.cardBox.h,
      );
      expect(item.bodyBox.y + item.bodyBox.h).toBeLessThanOrEqual(
        item.cardBox.y + item.cardBox.h,
      );
      expect(item.titleFontSize).toBeLessThanOrEqual(
        PRESENTATION_DEFAULT_THEME.typography.cardTitle,
      );
      expect(item.bodyFontSize).toBeLessThanOrEqual(
        PRESENTATION_DEFAULT_THEME.typography.cardBody,
      );
    });
  });

  it("returns BOX_TOO_SMALL warnings without mutating the presentation", () => {
    const engine = new PptxLayoutEngineService();
    const presentation: Presentation = {
      id: "presentation_tiny",
      type: "presentation",
      slides: [
        {
          id: "slide_tiny",
          type: "slide",
          root_container: {
            type: "stack",
            children: Array.from({ length: 40 }, (_, index) => ({
              id: `el_${index}`,
              type: "text" as const,
              text: `Text ${index}`,
            })),
          },
        },
      ],
    };
    const before = structuredClone(presentation);

    const layout = engine.layoutPresentation(presentation);

    expect(layout.issues.map((issue) => issue.code)).toContain("BOX_TOO_SMALL");
    expect(presentation).toEqual(before);
  });

  it("is exposed through the PPTX export service", () => {
    const service = createService();
    const presentation: Presentation = {
      id: "presentation_service_layout",
      type: "presentation",
      slides: [createContentSlide()],
    };

    const layout = service.layoutPresentation({
      presentation,
      options: { slideSize: "wide-16-9" },
    });

    expect(layout.presentationId).toBe("presentation_service_layout");
    expect(layout.slides).toHaveLength(1);
  });
});
