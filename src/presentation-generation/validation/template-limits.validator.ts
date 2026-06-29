import type {
  LayoutChild,
  LayoutContainer,
} from "../schemas/container-schema";
import type { Element } from "../schemas/element-schema";
import type { Slide } from "../schemas/slide-schema";
import type { Template, TemplateLimits } from "../schemas/template-schema";
import {
  createValidationIssue,
  invalid,
  valid,
  type ValidationIssue,
  type ValidationResult,
} from "./validation-result";

type ElementEntry = {
  element: Element;
  path: string;
};

/**
 * Validates objective template limits that do not affect DSL renderability.
 *
 * Text line limits are intentionally not checked here: line counting depends on
 * renderer width, typography, and locale. This validator only checks count-like
 * limits with clear semantics.
 */
export function validateSlideTemplateLimits(
  slide: Slide,
  template: Template,
): ValidationResult {
  const limits = template.limits;

  if (!limits) {
    return valid();
  }

  const elements = collectElements(slide);
  const issues: ValidationIssue[] = [];

  validateElementItemLimits(elements, limits, issues);
  validateImageCountLimit(elements, limits, issues);

  return issues.length > 0 ? invalid(issues) : valid();
}

function validateElementItemLimits(
  elements: ElementEntry[],
  limits: TemplateLimits,
  issues: ValidationIssue[],
): void {
  for (const entry of elements) {
    const { element, path } = entry;

    if (element.type === "bullets") {
      validateMax({
        actual: element.items.length,
        limit: limits.bullets_max_items,
        path: `${path}.items`,
        code: "template_limit_bullets_max_items_exceeded",
        label: "Bullet item count",
        issues,
      });
      continue;
    }

    if (element.type === "cards") {
      validateMin({
        actual: element.items.length,
        limit: limits.cards_min_items,
        path: `${path}.items`,
        code: "template_limit_cards_min_items_not_met",
        label: "Card item count",
        issues,
      });
      validateMax({
        actual: element.items.length,
        limit: limits.cards_max_items,
        path: `${path}.items`,
        code: "template_limit_cards_max_items_exceeded",
        label: "Card item count",
        issues,
      });
      continue;
    }

    if (element.type === "table") {
      validateMax({
        actual: element.rows.length,
        limit: limits.table_max_rows,
        path: `${path}.rows`,
        code: "template_limit_table_max_rows_exceeded",
        label: "Table row count",
        issues,
      });
      continue;
    }

    if (
      element.type === "chart" &&
      (element.chart_type === "bar" || element.chart_type === "line")
    ) {
      validateMax({
        actual: element.series.length,
        limit: limits.chart_max_series,
        path: `${path}.series`,
        code: "template_limit_chart_max_series_exceeded",
        label: "Chart series count",
        issues,
      });
    }
  }
}

function validateImageCountLimit(
  elements: ElementEntry[],
  limits: TemplateLimits,
  issues: ValidationIssue[],
): void {
  const imageCount = elements.filter((entry) => entry.element.type === "image")
    .length;

  validateMin({
    actual: imageCount,
    limit: imageCount > 0 ? limits.images_min_items : undefined,
    path: "root_container",
    code: "template_limit_images_min_items_not_met",
    label: "Image element count",
    issues,
  });
  validateMax({
    actual: imageCount,
    limit: limits.images_max_items,
    path: "root_container",
    code: "template_limit_images_max_items_exceeded",
    label: "Image element count",
    issues,
  });
}

function validateMin(input: {
  actual: number;
  limit: number | undefined;
  path: string;
  code: string;
  label: string;
  issues: ValidationIssue[];
}): void {
  if (input.limit === undefined || input.actual >= input.limit) {
    return;
  }

  input.issues.push(
    createValidationIssue(
      input.path,
      input.code,
      `${input.label} is ${input.actual}, template minimum is ${input.limit}`,
    ),
  );
}

function validateMax(input: {
  actual: number;
  limit: number | undefined;
  path: string;
  code: string;
  label: string;
  issues: ValidationIssue[];
}): void {
  if (input.limit === undefined || input.actual <= input.limit) {
    return;
  }

  input.issues.push(
    createValidationIssue(
      input.path,
      input.code,
      `${input.label} is ${input.actual}, template maximum is ${input.limit}`,
    ),
  );
}

function collectElements(slide: Slide): ElementEntry[] {
  const elements: ElementEntry[] = [];

  collectContainerElements(slide.root_container, "root_container", elements);

  return elements;
}

function collectContainerElements(
  container: LayoutContainer,
  path: string,
  elements: ElementEntry[],
): void {
  const children = container.children as LayoutChild[];

  children.forEach((child, index) => {
    const childPath = `${path}.children[${index}]`;

    if (isLayoutContainer(child)) {
      collectContainerElements(child, childPath, elements);
      return;
    }

    elements.push({
      element: child,
      path: childPath,
    });
  });
}

function isLayoutContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}
