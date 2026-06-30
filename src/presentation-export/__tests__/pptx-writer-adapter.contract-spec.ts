import { PptxGenJsAdapter } from "../pptx/writer";

describe("PptxGenJS writer adapter", () => {
  it("creates an editable PPTX presentation buffer behind opaque handles", async () => {
    const adapter = new PptxGenJsAdapter();
    const presentation = adapter.createPresentation({
      metadata: {
        title: "Writer adapter contract",
        author: "AI Presentations",
      },
    });
    const slide = adapter.addSlide(presentation);

    expect(presentation.kind).toBe("pptx_writer_presentation");
    expect(slide.kind).toBe("pptx_writer_slide");
    expect(Object.keys(presentation).sort()).toEqual(["id", "kind"]);
    expect(Object.keys(slide).sort()).toEqual(["id", "kind"]);
    adapter.addText(slide, "Hello writer", {
      x: 0.5,
      y: 0.5,
      w: 3,
      h: 0.5,
      objectName: "writer_text",
      fontSize: 18,
      color: "111827",
    });
    adapter.addShape(slide, "rect", {
      x: 0.5,
      y: 1.2,
      w: 2,
      h: 0.5,
      objectName: "writer_shape",
      fill: { color: "DBEAFE" },
      line: { color: "2563EB", width: 1 },
    });

    const buffer = await adapter.writeBuffer(presentation);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("uses independent presentation handles", async () => {
    const adapter = new PptxGenJsAdapter();
    const firstPresentation = adapter.createPresentation();
    const secondPresentation = adapter.createPresentation();

    adapter.addSlide(firstPresentation);
    adapter.addSlide(secondPresentation);

    const firstBuffer = await adapter.writeBuffer(firstPresentation);
    const secondBuffer = await adapter.writeBuffer(secondPresentation);

    expect(firstPresentation.id).not.toBe(secondPresentation.id);
    expect(firstBuffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(secondBuffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("rejects unknown presentation handles", async () => {
    const adapter = new PptxGenJsAdapter();
    const unknownPresentation = {
      kind: "pptx_writer_presentation" as const,
      id: "external",
    };

    await expect(adapter.writeBuffer(unknownPresentation)).rejects.toThrow(
      "Unknown PPTX writer presentation handle",
    );
  });

  it("rejects unknown slide handles", () => {
    const adapter = new PptxGenJsAdapter();
    const unknownSlide = {
      kind: "pptx_writer_slide" as const,
      id: "external",
    };

    expect(() =>
      adapter.addText(unknownSlide, "Unknown", {
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      }),
    ).toThrow("Unknown PPTX writer slide handle");
  });
});
