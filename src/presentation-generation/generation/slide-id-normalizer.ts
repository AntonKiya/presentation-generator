import type {
  LayoutChild,
  LayoutContainer,
} from "../schemas/container-schema";
import type { Element } from "../schemas/element-schema";
import type { Slide } from "../schemas/slide-schema";

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

/**
 * LLM ids are accepted only to satisfy the response schema.
 * Final technical ids are backend-owned and assigned deterministically.
 */
export function normalizeSlideIds(slide: Slide, slideIndex: number): Slide {
  let elementCounter = 0;
  let existingContainerIdCounter = 0;

  const normalizeChild = (child: LayoutChild): LayoutChild => {
    if (isElement(child)) {
      elementCounter += 1;

      return {
        ...child,
        id: `el_${slideIndex}_${elementCounter}`,
      };
    }

    return normalizeContainer(child);
  };

  const nextContainerId = (): string => {
    existingContainerIdCounter += 1;

    return `container_${slideIndex}_${existingContainerIdCounter}`;
  };

  const normalizeContainer = (
    container: LayoutContainer,
  ): LayoutContainer => {
    const normalizedContainerId =
      container.id === undefined ? undefined : nextContainerId();

    const normalizedContainer = {
      ...container,
      children: container.children.map(normalizeChild),
    };

    if (normalizedContainerId === undefined) {
      return normalizedContainer;
    }

    return {
      ...normalizedContainer,
      id: normalizedContainerId,
    };
  };

  return {
    ...slide,
    id: `slide_${slideIndex}`,
    root_container: normalizeContainer(slide.root_container),
  };
}

function isElement(child: LayoutChild): child is Element {
  return ELEMENT_TYPES.has(child.type as Element["type"]);
}
