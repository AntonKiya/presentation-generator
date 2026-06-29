import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type {
  OutlineGenerationResult,
  OutlineSlide,
} from "./schemas/generation-schema";
import type { Slide } from "./schemas/slide-schema";
import type { Template, Templates } from "./schemas/template-schema";

const SYSTEM_PROMPT = [
  "You generate presentations in a strict JSON DSL.",
  "Return only the JSON object required by the response schema.",
  "Do not use Markdown, comments, explanations, or extra wrapper fields.",
  "Reason internally before answering, but never output reasoning.",
  "The internal presentation format is not PPTX.",
  "Slides must use root_container with layout containers before elements.",
].join("\n");

export function buildOutlineMessages(
  userRequest: string,
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        "Create a logical outline for a presentation.",
        "",
        "Rules:",
        "- Return only the outline object.",
        "- Do not generate slide DSL yet.",
        "- Respect the requested slide count if the user provided one.",
        "- Use concise, presentation-ready slide titles.",
        "- Each slide must have index, title, and intent.",
        "",
        "User request:",
        userRequest,
      ].join("\n"),
    },
  ];
}

export function buildPerSlideMessages(input: {
  fullOutline: OutlineGenerationResult;
  currentSlide: OutlineSlide;
  templates: Templates;
  availableElements: readonly string[];
  previousSlides: Slide[];
}): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        "Generate exactly one final slide in the internal JSON DSL.",
        "",
        "You must return this wrapper:",
        "{ \"template_id\": string, \"slide\": Slide }",
        "",
        "Core DSL rules:",
        "- slide.type must be \"slide\".",
        "- slide must contain root_container.",
        "- slide must not contain a flat elements array.",
        "- Supported layout container types: stack, row, grid.",
        "- Do not use column as a container type.",
        "- A column is represented as a child layout container inside row with width.",
        "- Supported element types are listed below.",
        "- Put elements inside layout containers only.",
        "- Use the selected template layout_container_tree as the structural base.",
        "- Fill template slots with suitable elements.",
        "- Preserve the template's main structure and slot intent.",
        "- slot is a semantic placeholder in the template.",
        "- accepts is the complete list of element.type values allowed in that slot.",
        "- If a container has accepts, every direct element child inside it must have type included in accepts.",
        "- Inside a fillable slot, you may use nested stack/row/grid containers for local layout.",
        "- Nested containers inside a fillable slot must not define slot, accepts, or required.",
        "- Every descendant element inside a fillable slot must match the parent slot accepts list.",
        "- required: true means this slot must contain at least one valid accepted element.",
        "- required: false means this slot may stay empty, but if filled it must still respect accepts.",
        "- Do not add element types outside the parent slot accepts.",
        "- Do not remove required slot containers from the template structure.",
        "- If a required slot accepts multiple types, choose one or more suitable accepted element types.",
        "- Respect selected template limits. Item counts, table rows, and chart series should stay within the template limits.",
        "- Avoid repeating ideas already covered by previous slides.",
        "- Keep copy concise enough for a slide.",
        "- If you use image, set asset_id to a stable placeholder id and include alt.",
        "",
        "Available elements:",
        JSON.stringify(input.availableElements),
        "",
        "Available templates:",
        JSON.stringify(input.templates, null, 2),
        "",
        "Full outline:",
        JSON.stringify(input.fullOutline, null, 2),
        "",
        "Current slide outline:",
        JSON.stringify(input.currentSlide, null, 2),
        "",
        "Previous generated valid slides:",
        JSON.stringify(input.previousSlides, null, 2),
      ].join("\n"),
    },
  ];
}

export function buildPerSlideRepairMessages(input: {
  fullOutline: OutlineGenerationResult;
  currentSlide: OutlineSlide;
  templates: Templates;
  selectedTemplate: Template | undefined;
  availableElements: readonly string[];
  previousSlides: Slide[];
  rawResponse: string;
  issues: unknown;
}): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        "Repair one invalid per-slide generation response.",
        "",
        "You must return this same wrapper:",
        "{ \"template_id\": string, \"slide\": Slide }",
        "",
        "Repair rules:",
        "- Fix only the invalid JSON, schema, or DSL parts reported in validation errors.",
        "- Preserve the slide meaning and content unless the error makes that impossible.",
        "- Preserve template_id when it exists and is one of the available templates.",
        "- Do not change the selected template unless template_id is missing or unknown.",
        "- Use the selected template layout_container_tree as the structural base.",
        "- Do not remove required slot containers from the template structure.",
        "- Every descendant element inside a fillable slot must match the parent slot accepts list.",
        "- Nested containers inside a fillable slot must not define slot, accepts, or required.",
        "- Return only the corrected JSON object.",
        "",
        "Available elements:",
        JSON.stringify(input.availableElements),
        "",
        "Available templates:",
        JSON.stringify(input.templates, null, 2),
        "",
        "Selected template resolved from previous response:",
        input.selectedTemplate
          ? JSON.stringify(input.selectedTemplate, null, 2)
          : "No valid selected template was resolved. Choose the best available template.",
        "",
        "Full outline:",
        JSON.stringify(input.fullOutline, null, 2),
        "",
        "Current slide outline:",
        JSON.stringify(input.currentSlide, null, 2),
        "",
        "Previous generated valid slides:",
        JSON.stringify(input.previousSlides, null, 2),
        "",
        "Invalid previous response:",
        input.rawResponse,
        "",
        "Validation errors:",
        JSON.stringify(input.issues, null, 2),
      ].join("\n"),
    },
  ];
}

export function buildRetryMessages(input: {
  originalMessages: ChatCompletionMessageParam[];
  rawResponse: string;
  issues: unknown;
}): ChatCompletionMessageParam[] {
  return [
    ...input.originalMessages,
    {
      role: "assistant",
      content: input.rawResponse,
    },
    {
      role: "user",
      content: [
        "The previous response was invalid.",
        "Fix only the invalid format or DSL parts needed to satisfy the schema and validation rules.",
        "Do not change the meaning unless required by the validation errors.",
        "Respect template slot rules: accepts is the complete allowed element.type list, and required slots must contain at least one accepted element.",
        "Return only the corrected JSON object.",
        "",
        "Validation errors:",
        JSON.stringify(input.issues, null, 2),
      ].join("\n"),
    },
  ];
}
