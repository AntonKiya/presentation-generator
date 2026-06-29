import type {
  LayoutChild,
  LayoutContainer,
} from "../schemas/container-schema";
import type { Element } from "../schemas/element-schema";
import type { Presentation } from "../schemas/presentation-schema";
import type { Slide } from "../schemas/slide-schema";
import type { Template } from "../schemas/template-schema";
import { loadTemplates } from "../generation/template-registry";

const ELEMENT_TYPES = new Set<Element["type"]>([
  "title",
  "subtitle",
  "text",
  "bullets",
  "image",
  "cards",
  "table",
  "chart",
]);

export async function loadTemplateFixture(templateId: string): Promise<Template> {
  const registry = await loadTemplates();
  const template = registry.byId.get(templateId);

  if (!template) {
    throw new Error(`Template fixture was not found: ${templateId}`);
  }

  return template;
}

export function cloneSlide(slide: Slide): Slide {
  return structuredClone(slide) as Slide;
}

export function createContentSlide(): Slide {
  return {
    id: "llm_slide",
    type: "slide",
    root_container: {
      type: "stack",
      gap: 18,
      children: [
        {
          type: "stack",
          slot: "title",
          accepts: ["title", "subtitle"],
          required: true,
          children: [
            {
              id: "llm_title",
              type: "title",
              text: "Strategic context",
            },
          ],
        },
        {
          type: "stack",
          slot: "body",
          accepts: ["text", "bullets", "cards"],
          required: true,
          children: [
            {
              id: "llm_body",
              type: "text",
              text: "A concise explanation for the slide body.",
            },
          ],
        },
      ],
    },
  };
}

export function createDataFocusChartSlide(seriesCount = 1): Slide {
  return {
    id: "llm_slide",
    type: "slide",
    root_container: {
      type: "stack",
      gap: 18,
      children: [
        {
          type: "stack",
          slot: "title",
          accepts: ["title", "subtitle"],
          required: true,
          children: [
            {
              id: "llm_title",
              type: "title",
              text: "Data focus",
            },
          ],
        },
        {
          type: "row",
          gap: 24,
          children: [
            {
              type: "stack",
              slot: "data",
              width: 0.65,
              accepts: ["chart", "table"],
              required: true,
              children: [
                {
                  id: "llm_chart",
                  type: "chart",
                  chart_type: "bar",
                  labels: ["A", "B"],
                  series: Array.from({ length: seriesCount }, (_, index) => ({
                    label: `Series ${index + 1}`,
                    values: [index + 1, index + 2],
                  })),
                },
              ],
            },
            {
              type: "stack",
              slot: "comment",
              width: 0.35,
              accepts: ["text", "bullets"],
              required: false,
              children: [
                {
                  id: "llm_comment",
                  type: "text",
                  text: "Short data interpretation.",
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

export function createDataFocusTableSlide(rowCount = 1): Slide {
  const rows = Array.from({ length: rowCount }, (_, index) => [
    `Row ${index + 1}`,
    String(index + 1),
  ]);

  return {
    id: "llm_slide",
    type: "slide",
    root_container: {
      type: "stack",
      gap: 18,
      children: [
        {
          type: "stack",
          slot: "title",
          accepts: ["title", "subtitle"],
          required: true,
          children: [
            {
              id: "llm_title",
              type: "title",
              text: "Table focus",
            },
          ],
        },
        {
          type: "row",
          gap: 24,
          children: [
            {
              type: "stack",
              slot: "data",
              width: 0.65,
              accepts: ["chart", "table"],
              required: true,
              children: [
                {
                  id: "llm_table",
                  type: "table",
                  columns: ["Metric", "Value"],
                  rows,
                },
              ],
            },
            {
              type: "stack",
              slot: "comment",
              width: 0.35,
              accepts: ["text", "bullets"],
              required: false,
              children: [],
            },
          ],
        },
      ],
    },
  };
}

export function createAllElementsPresentation(): Presentation {
  return {
    id: "presentation_1",
    type: "presentation",
    title: "Contract fixture",
    slides: [
      {
        id: "slide_1",
        type: "slide",
        root_container: {
          type: "stack",
          gap: 12,
          children: [
            { id: "el_1_1", type: "title", text: "Title" },
            { id: "el_1_2", type: "subtitle", text: "Subtitle" },
            { id: "el_1_3", type: "text", text: "Body text" },
            {
              id: "el_1_4",
              type: "bullets",
              items: ["One", "Two"],
            },
            {
              id: "el_1_5",
              type: "image",
              asset_id: "placeholder://image",
              alt: "Placeholder image",
            },
            {
              id: "el_1_6",
              type: "cards",
              items: [
                { title: "Card one", text: "First card" },
                { title: "Card two", text: "Second card" },
              ],
            },
            {
              id: "el_1_7",
              type: "table",
              columns: ["Metric", "Value"],
              rows: [["A", "10"]],
            },
            {
              id: "el_1_8",
              type: "chart",
              chart_type: "bar",
              labels: ["A", "B"],
              series: [{ label: "Series", values: [1, 2] }],
            },
          ],
        },
      },
    ],
  };
}

export function getContainerChild(
  container: LayoutContainer,
  index: number,
): LayoutContainer {
  const child = container.children[index];

  if (!child || !isLayoutContainer(child)) {
    throw new Error(`Expected container child at index ${index}`);
  }

  return child;
}

export function findElement(
  children: LayoutChild[],
  type: Element["type"],
): Element {
  const element = findElementOptional(children, type);

  if (!element) {
    throw new Error(`Expected element fixture of type ${type}`);
  }

  return element;
}

function findElementOptional(
  children: LayoutChild[],
  type: Element["type"],
): Element | undefined {
  for (const child of children) {
    if (isElement(child)) {
      if (child.type === type) {
        return child;
      }

      continue;
    }

    if (isLayoutContainer(child)) {
      const nestedElement = findElementOptional(child.children, type);

      if (nestedElement) {
        return nestedElement;
      }

      continue;
    }
  }

  return undefined;
}

function isElement(child: LayoutChild): child is Element {
  return ELEMENT_TYPES.has(child.type as Element["type"]);
}

function isLayoutContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}
