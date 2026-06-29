import { PresentationSchema } from "../schemas/presentation-schema";
import {
  createAllElementsPresentation,
  findElement,
} from "./fixtures";

describe("presentation Zod contracts", () => {
  it("accepts a presentation with every MVP element type", () => {
    const presentation = createAllElementsPresentation();

    expect(PresentationSchema.safeParse(presentation).success).toBe(true);
  });

  it("rejects a slide-level flat elements array", () => {
    const presentation = createAllElementsPresentation();
    const candidate = {
      ...presentation,
      slides: [
        {
          ...presentation.slides[0],
          elements: [],
        },
      ],
    };

    expect(PresentationSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects table rows that do not match column count", () => {
    const presentation = createAllElementsPresentation();
    const table = findElement(
      presentation.slides[0].root_container.children,
      "table",
    );

    if (table.type !== "table") {
      throw new Error("Expected table fixture");
    }

    table.rows = [["Only one cell"]];

    expect(PresentationSchema.safeParse(presentation).success).toBe(false);
  });

  it("rejects chart series that do not match label count", () => {
    const presentation = createAllElementsPresentation();
    const chart = findElement(
      presentation.slides[0].root_container.children,
      "chart",
    );

    if (chart.type !== "chart" || chart.chart_type === "pie") {
      throw new Error("Expected series chart fixture");
    }

    chart.series[0].values = [1];

    expect(PresentationSchema.safeParse(presentation).success).toBe(false);
  });
});
