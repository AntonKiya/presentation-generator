import { Logger } from "@nestjs/common";
import { PresentationPreviewService } from "../presentation-preview.service";
import { PresentationSchema } from "../schemas/presentation-schema";
import { createAllElementsPresentation } from "./fixtures";

describe("preview renderer smoke contract", () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it("renders valid DSL with every MVP element type without throwing", () => {
    const presentation = PresentationSchema.parse(createAllElementsPresentation());
    const renderer = new PresentationPreviewService();

    const html = renderer.renderHtml(presentation);

    expect(html).toContain('<section class="slide" data-slide="1"');
    expect(html).toContain("--preview-slide-width:1120px");
    expect(html).toContain('style="left:');
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Subtitle</h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("image-placeholder");
    expect(html).toContain("cards");
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>bar chart</strong>");
  });
});
