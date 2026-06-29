import type {
  LayoutChild,
  LayoutContainer,
} from "../schemas/container-schema";
import type { Element, ElementType } from "../schemas/element-schema";
import type { Slide } from "../schemas/slide-schema";
import type { Template, TemplateLayoutNode } from "../schemas/template-schema";
import {
  createValidationIssue,
  invalid,
  valid,
  type ValidationIssue,
  type ValidationResult,
} from "./validation-result";

/**
 * Template matching semantics:
 * - The template layout tree is canonical until a fillable slot is reached.
 * - A fillable slot is a template node with `accepts`.
 * - Matched template nodes must preserve key layout/slot fields.
 * - Inside a fillable slot, the model may add nested layout containers.
 * - Nested containers inside a fillable slot must not create new slots,
 *   accepts, or required rules.
 * - Every descendant element inside a fillable slot must match that slot's
 *   accepts list.
 */
export function validateSlideAgainstTemplate(
  slide: Slide,
  template: Template,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  validateContainerAgainstTemplateNode({
    slideNode: slide.root_container,
    templateNode: template.layout_container_tree,
    path: "root_container",
    issues,
  });

  return issues.length > 0 ? invalid(issues) : valid();
}

function validateContainerAgainstTemplateNode(input: {
  slideNode: LayoutContainer;
  templateNode: TemplateLayoutNode;
  path: string;
  issues: ValidationIssue[];
}): void {
  const { slideNode, templateNode, path, issues } = input;

  const fieldsMatch = validateMatchedContainerFields(
    slideNode,
    templateNode,
    path,
    issues,
  );

  if (!fieldsMatch) {
    return;
  }

  if (isFillableTemplateNode(templateNode)) {
    validateFillableSlotSubtree({
      slotNode: slideNode,
      templateNode,
      path,
      issues,
    });
    return;
  }

  validateStructuralChildren({
    slideNode,
    templateNode,
    path,
    issues,
  });
}

function validateStructuralChildren(input: {
  slideNode: LayoutContainer;
  templateNode: TemplateLayoutNode;
  path: string;
  issues: ValidationIssue[];
}): void {
  const { slideNode, templateNode, path, issues } = input;
  const slideChildren = slideNode.children;
  const templateChildren = templateNode.children ?? [];

  if (slideChildren.length !== templateChildren.length) {
    issues.push(
      createValidationIssue(
        `${path}.children`,
        "template_children_count_mismatch",
        `Expected ${templateChildren.length} template children, received ${slideChildren.length}`,
      ),
    );
  }

  const comparableChildrenCount = Math.min(
    slideChildren.length,
    templateChildren.length,
  );

  for (let index = 0; index < comparableChildrenCount; index += 1) {
    const slideChild = slideChildren[index];
    const templateChild = templateChildren[index];
    const childPath = `${path}.children[${index}]`;

    if (!isLayoutContainer(slideChild)) {
      issues.push(
        createValidationIssue(
          childPath,
          "template_expected_container",
          "Template structural children must be layout containers, not elements",
        ),
      );
      continue;
    }

    validateContainerAgainstTemplateNode({
      slideNode: slideChild,
      templateNode: templateChild,
      path: childPath,
      issues,
    });
  }

  for (
    let index = comparableChildrenCount;
    index < slideChildren.length;
    index += 1
  ) {
    issues.push(
      createValidationIssue(
        `${path}.children[${index}]`,
        "template_unexpected_child",
        "Unexpected child outside template structure",
      ),
    );
  }
}

function validateFillableSlotSubtree(input: {
  slotNode: LayoutContainer;
  templateNode: TemplateLayoutNode;
  path: string;
  issues: ValidationIssue[];
}): void {
  const { slotNode, templateNode, path, issues } = input;
  const accepts = templateNode.accepts ?? [];
  const acceptedTypes = new Set<ElementType>(accepts);
  let acceptedElementsCount = 0;

  walkSlotChildren(slotNode.children, `${path}.children`, {
    acceptedTypes,
    issues,
    onAcceptedElement: () => {
      acceptedElementsCount += 1;
    },
  });

  if (templateNode.required === true && acceptedElementsCount === 0) {
    issues.push(
      createValidationIssue(
        path,
        "required_slot_empty",
        `Required slot${templateNode.slot ? ` "${templateNode.slot}"` : ""} must contain at least one accepted element`,
      ),
    );
  }
}

function walkSlotChildren(
  children: LayoutChild[],
  path: string,
  context: {
    acceptedTypes: Set<ElementType>;
    issues: ValidationIssue[];
    onAcceptedElement: () => void;
  },
): void {
  children.forEach((child, index) => {
    const childPath = `${path}[${index}]`;

    if (isLayoutContainer(child)) {
      validateNestedLayoutContainerInSlot(child, childPath, context.issues);
      walkSlotChildren(child.children, `${childPath}.children`, context);
      return;
    }

    validateSlotElement(child, childPath, context);
  });
}

function validateNestedLayoutContainerInSlot(
  container: LayoutContainer,
  path: string,
  issues: ValidationIssue[],
): void {
  if (container.slot !== undefined) {
    issues.push(
      createValidationIssue(
        `${path}.slot`,
        "nested_slot_not_allowed",
        "Nested layout containers inside a fillable slot must not define slot",
      ),
    );
  }

  if (container.accepts !== undefined) {
    issues.push(
      createValidationIssue(
        `${path}.accepts`,
        "nested_accepts_not_allowed",
        "Nested layout containers inside a fillable slot must not define accepts",
      ),
    );
  }

  if (container.required !== undefined) {
    issues.push(
      createValidationIssue(
        `${path}.required`,
        "nested_required_not_allowed",
        "Nested layout containers inside a fillable slot must not define required",
      ),
    );
  }
}

function validateSlotElement(
  element: Element,
  path: string,
  context: {
    acceptedTypes: Set<ElementType>;
    issues: ValidationIssue[];
    onAcceptedElement: () => void;
  },
): void {
  if (!context.acceptedTypes.has(element.type)) {
    context.issues.push(
      createValidationIssue(
        `${path}.type`,
        "slot_element_type_not_accepted",
        `Element type "${element.type}" is not accepted by this slot`,
      ),
    );
    return;
  }

  context.onAcceptedElement();
}

function validateMatchedContainerFields(
  slideNode: LayoutContainer,
  templateNode: TemplateLayoutNode,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (slideNode.type !== templateNode.type) {
    issues.push(
      createValidationIssue(
        `${path}.type`,
        "template_container_type_mismatch",
        `Expected container type "${templateNode.type}", received "${slideNode.type}"`,
      ),
    );
    return false;
  }

  validateOptionalField({
    field: "slot",
    slideValue: slideNode.slot,
    templateValue: templateNode.slot,
    path,
    issues,
  });

  validateAcceptsField(slideNode, templateNode, path, issues);
  validateRequiredField(slideNode, templateNode, path, issues);

  validateOptionalField({
    field: "gap",
    slideValue: slideNode.gap,
    templateValue: templateNode.gap,
    path,
    issues,
  });

  validateOptionalField({
    field: "padding",
    slideValue: slideNode.padding,
    templateValue: templateNode.padding,
    path,
    issues,
  });

  validateOptionalField({
    field: "align",
    slideValue: slideNode.align,
    templateValue: templateNode.align,
    path,
    issues,
  });

  validateOptionalField({
    field: "justify",
    slideValue: slideNode.justify,
    templateValue: templateNode.justify,
    path,
    issues,
  });

  validateOptionalField({
    field: "width",
    slideValue: slideNode.width,
    templateValue: templateNode.width,
    path,
    issues,
  });

  if (templateNode.type === "grid" || slideNode.type === "grid") {
    validateOptionalField({
      field: "columns",
      slideValue: slideNode.type === "grid" ? slideNode.columns : undefined,
      templateValue:
        templateNode.type === "grid" ? templateNode.columns : undefined,
      path,
      issues,
    });
  }

  return true;
}

function validateAcceptsField(
  slideNode: LayoutContainer,
  templateNode: TemplateLayoutNode,
  path: string,
  issues: ValidationIssue[],
): void {
  if (templateNode.accepts === undefined && slideNode.accepts !== undefined) {
    issues.push(
      createValidationIssue(
        `${path}.accepts`,
        "template_unexpected_accepts",
        "Container must not define accepts when the template node does not define accepts",
      ),
    );
    return;
  }

  if (templateNode.accepts === undefined) {
    return;
  }

  if (!arraysEqual(slideNode.accepts, templateNode.accepts)) {
    issues.push(
      createValidationIssue(
        `${path}.accepts`,
        "template_accepts_mismatch",
        `Expected accepts ${JSON.stringify(templateNode.accepts)}, received ${JSON.stringify(slideNode.accepts)}`,
      ),
    );
  }
}

function validateRequiredField(
  slideNode: LayoutContainer,
  templateNode: TemplateLayoutNode,
  path: string,
  issues: ValidationIssue[],
): void {
  if (templateNode.required === true && slideNode.required !== true) {
    issues.push(
      createValidationIssue(
        `${path}.required`,
        "template_required_mismatch",
        "Container must preserve required=true from template",
      ),
    );
    return;
  }

  if (templateNode.required !== true && slideNode.required === true) {
    issues.push(
      createValidationIssue(
        `${path}.required`,
        "template_unexpected_required",
        "Container must not make an optional template node required",
      ),
    );
  }
}

function validateOptionalField(input: {
  field:
    | "slot"
    | "gap"
    | "padding"
    | "align"
    | "justify"
    | "width"
    | "columns";
  slideValue: unknown;
  templateValue: unknown;
  path: string;
  issues: ValidationIssue[];
}): void {
  const { field, slideValue, templateValue, path, issues } = input;

  if (templateValue === undefined && slideValue === undefined) {
    return;
  }

  if (templateValue === undefined && slideValue !== undefined) {
    issues.push(
      createValidationIssue(
        `${path}.${field}`,
        "template_unexpected_field",
        `Container must not define ${field} when the template node does not define it`,
      ),
    );
    return;
  }

  if (!valuesEqual(slideValue, templateValue)) {
    issues.push(
      createValidationIssue(
        `${path}.${field}`,
        "template_field_mismatch",
        `Expected ${field}=${JSON.stringify(templateValue)}, received ${JSON.stringify(slideValue)}`,
      ),
    );
  }
}

function isFillableTemplateNode(
  templateNode: TemplateLayoutNode,
): templateNode is TemplateLayoutNode & { accepts: ElementType[] } {
  return Array.isArray(templateNode.accepts) && templateNode.accepts.length > 0;
}

function isLayoutContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}

function arraysEqual<T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return arraysEqual(left as unknown[], right as unknown[]);
  }

  return left === right;
}
