import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  AVAILABLE_ELEMENT_TYPES,
  OutlineGenerationResultSchema,
  PerSlideGenerationResultSchema,
  type OutlineGenerationResult,
  type PerSlideGenerationResult,
} from "./schemas/generation-schema";
import {
  PresentationSchema,
  type Presentation,
} from "./schemas/presentation-schema";
import type {
  LayoutChild,
  LayoutContainer,
} from "./schemas/container-schema";
import type { Element } from "./schemas/element-schema";
import type { Slide } from "./schemas/slide-schema";
import {
  normalizeZodIssues,
  type ValidationIssue,
} from "./generation/validation";
import {
  OutlineGenerationResponseJsonSchema,
  PerSlideGenerationResponseJsonSchema,
} from "./generation/response-json-schemas";
import { OpenRouterLlmService } from "./openrouter-llm.service";
import {
  buildOutlineMessages,
  buildPerSlideMessages,
  buildRetryMessages,
} from "./presentation-generation.prompts";
import { TemplateRegistryService } from "./template-registry.service";

type AttemptDebug = {
  step: string;
  attempt: number;
  rawResponse?: string;
  issues?: ValidationIssue[] | unknown;
  model?: string;
  usage?: unknown;
};

export type GeneratedSlideDebug = {
  template_id: string;
  slide: Slide;
};

export type GeneratePresentationResult = {
  outline: OutlineGenerationResult;
  slides: GeneratedSlideDebug[];
  presentation: Presentation;
  debug: {
    trace_id: string;
    attempts: AttemptDebug[];
  };
};

@Injectable()
export class PresentationGenerationService {
  private readonly logger = new Logger(PresentationGenerationService.name);

  constructor(
    private readonly templateRegistry: TemplateRegistryService,
    private readonly llm: OpenRouterLlmService,
  ) {}

  getGenerationStaticContext() {
    return {
      templates: this.templateRegistry.getTemplates(),
      elements: AVAILABLE_ELEMENT_TYPES,
    };
  }

  async generatePresentation(
    userRequest: string,
  ): Promise<GeneratePresentationResult> {
    const traceId = createTraceId();
    const startedAt = Date.now();
    const attempts: AttemptDebug[] = [];

    this.logger.log(
      `[${traceId}] Generation start promptChars=${userRequest.length} promptPreview="${previewText(userRequest)}" templates=${this.templateRegistry.getTemplates().length} elements=${AVAILABLE_ELEMENT_TYPES.length}`,
    );

    try {
      const outline = await this.generateOutline(userRequest, attempts, traceId);
      const generatedSlides: GeneratedSlideDebug[] = [];
      const previousSlides: Slide[] = [];

      for (const outlineSlide of outline.slides) {
        const slideResult = await this.generateSlide(
          outline,
          outlineSlide.index,
          previousSlides,
          attempts,
          traceId,
        );

        generatedSlides.push({
          template_id: slideResult.template_id,
          slide: slideResult.slide,
        });
        previousSlides.push(slideResult.slide);
      }

      const presentationCandidate = {
        id: "presentation_1",
        type: "presentation",
        title: outline.title,
        slides: previousSlides,
      };

      this.logger.log(
        `[${traceId}] Final presentation validation start slides=${previousSlides.length}`,
      );

      const parsedPresentation = PresentationSchema.safeParse(
        presentationCandidate,
      );

      if (!parsedPresentation.success) {
        const issues = normalizeZodIssues(parsedPresentation.error);

        this.logger.error(
          `[${traceId}] Final presentation validation failed issues=${summarizeIssues(issues)}`,
        );

        throw new UnprocessableEntityException({
          message: "Generated presentation failed final validation",
          issues,
          attempts,
        });
      }

      this.logger.log(
        `[${traceId}] Generation complete slides=${parsedPresentation.data.slides.length} attempts=${attempts.length} durationMs=${Date.now() - startedAt}`,
      );

      return {
        outline,
        slides: generatedSlides,
        presentation: parsedPresentation.data,
        debug: {
          trace_id: traceId,
          attempts,
        },
      };
    } catch (error) {
      this.logger.error(
        `[${traceId}] Generation failed durationMs=${Date.now() - startedAt} error=${formatError(error)}`,
      );
      throw error;
    }
  }

  private async generateOutline(
    userRequest: string,
    attempts: AttemptDebug[],
    traceId: string,
  ): Promise<OutlineGenerationResult> {
    const messages = buildOutlineMessages(userRequest);

    this.logger.log(
      `[${traceId}] Outline generation start promptChars=${userRequest.length}`,
    );

    const outline = await this.callWithRetry({
      traceId,
      step: "outline",
      schemaName: "outline_generation_result",
      jsonSchema: OutlineGenerationResponseJsonSchema,
      strict: true,
      messages,
      attempts,
      validate: (input) => {
        const parsed = OutlineGenerationResultSchema.safeParse(input);

        if (!parsed.success) {
          return {
            success: false as const,
            issues: normalizeZodIssues(parsed.error),
          };
        }

        return {
          success: true as const,
          data: parsed.data,
        };
      },
    });

    this.logger.log(
      `[${traceId}] Outline generated title="${outline.title ?? ""}" slides=${outline.slides.length} slideTitles="${outline.slides
        .map((slide) => `${slide.index}. ${slide.title}`)
        .join(" | ")}"`,
    );

    return outline;
  }

  private async generateSlide(
    outline: OutlineGenerationResult,
    slideIndex: number,
    previousSlides: Slide[],
    attempts: AttemptDebug[],
    traceId: string,
  ): Promise<PerSlideGenerationResult> {
    const currentSlide = outline.slides.find(
      (slide) => slide.index === slideIndex,
    );

    if (!currentSlide) {
      throw new UnprocessableEntityException({
        message: `Outline slide ${slideIndex} was not found`,
      });
    }

    this.logger.log(
      `[${traceId}] Slide generation start slideIndex=${slideIndex} title="${currentSlide.title}" previousSlides=${previousSlides.length}`,
    );

    const messages = buildPerSlideMessages({
      fullOutline: outline,
      currentSlide,
      templates: this.templateRegistry.getTemplates(),
      availableElements: AVAILABLE_ELEMENT_TYPES,
      previousSlides,
    });

    const result = await this.callWithRetry({
      traceId,
      step: `slide_${slideIndex}`,
      schemaName: "per_slide_generation_result",
      jsonSchema: PerSlideGenerationResponseJsonSchema,
      strict: false,
      messages,
      attempts,
      validate: (input) => {
        const parsed = PerSlideGenerationResultSchema.safeParse(input);

        if (!parsed.success) {
          return {
            success: false as const,
            issues: normalizeZodIssues(parsed.error),
          };
        }

        const template = this.templateRegistry.getTemplateById(
          parsed.data.template_id,
        );

        if (!template) {
          return {
            success: false as const,
            issues: [
              {
                path: "template_id",
                code: "unknown_template",
                message: `Unknown template_id: ${parsed.data.template_id}`,
              },
            ],
          };
        }

        return {
          success: true as const,
          data: parsed.data,
        };
      },
    });

    const metrics = inspectSlide(result.slide);

    this.logger.log(
      `[${traceId}] Slide generated slideIndex=${slideIndex} slideId=${result.slide.id} template=${result.template_id} containers=${metrics.containers} elements=${metrics.elements} elementTypes=${metrics.elementTypes.join(",")}`,
    );

    return result;
  }

  private async callWithRetry<T>(input: {
    traceId: string;
    step: string;
    schemaName: string;
    jsonSchema: Record<string, unknown>;
    strict: boolean;
    messages: Parameters<
      OpenRouterLlmService["generateStructuredJson"]
    >[0]["messages"];
    attempts: AttemptDebug[];
    validate: (
      data: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; issues: ValidationIssue[] | unknown };
  }): Promise<T> {
    let messages = input.messages;
    let lastIssues: ValidationIssue[] | unknown = [];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      this.logger.log(
        `[${input.traceId}] ${input.step} attempt=${attempt}/2 start schema=${input.schemaName} strict=${input.strict} messages=${input.messages.length}`,
      );

      const response = await this.llm.generateStructuredJson({
        traceId: input.traceId,
        schemaName: input.schemaName,
        jsonSchema: input.jsonSchema,
        strict: input.strict,
        messages,
      });

      const validationResult = response.parseError
        ? {
            success: false as const,
            issues: [
              {
                path: "",
                code: "invalid_json",
                message: response.parseError,
              },
            ],
          }
        : input.validate(response.parsed);

      input.attempts.push({
        step: input.step,
        attempt,
        rawResponse: response.rawText,
        issues: validationResult.success ? undefined : validationResult.issues,
        model: response.model,
        usage: response.usage,
      });

      if (validationResult.success) {
        this.logger.log(
          `[${input.traceId}] ${input.step} attempt=${attempt}/2 valid rawChars=${response.rawText.length}`,
        );
        return validationResult.data;
      }

      this.logger.warn(
        `[${input.traceId}] ${input.step} attempt=${attempt}/2 invalid rawChars=${response.rawText.length} issues=${summarizeIssues(validationResult.issues)}`,
      );

      lastIssues = validationResult.issues;
      messages = buildRetryMessages({
        originalMessages: input.messages,
        rawResponse: response.rawText,
        issues: validationResult.issues,
      });

      if (attempt < 2) {
        this.logger.log(`[${input.traceId}] ${input.step} retry scheduled`);
      }
    }

    this.logger.error(
      `[${input.traceId}] ${input.step} failed after retry issues=${summarizeIssues(lastIssues)}`,
    );

    throw new UnprocessableEntityException({
      message: `${input.step} generation failed validation after retry`,
      issues: lastIssues,
      attempts: input.attempts,
    });
  }
}

function createTraceId(): string {
  return `gen_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function previewText(value: string): string {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function inspectSlide(slide: Slide): {
  containers: number;
  elements: number;
  elementTypes: string[];
} {
  const metrics = inspectContainer(slide.root_container);

  return {
    containers: metrics.containers,
    elements: metrics.elements,
    elementTypes: [...metrics.elementTypes].sort(),
  };
}

function inspectContainer(container: LayoutContainer): {
  containers: number;
  elements: number;
  elementTypes: Set<string>;
} {
  const metrics = {
    containers: 1,
    elements: 0,
    elementTypes: new Set<string>(),
  };

  for (const child of container.children as LayoutChild[]) {
    if (isContainer(child)) {
      const childMetrics = inspectContainer(child);
      metrics.containers += childMetrics.containers;
      metrics.elements += childMetrics.elements;
      childMetrics.elementTypes.forEach((type) => metrics.elementTypes.add(type));
    } else {
      metrics.elements += 1;
      metrics.elementTypes.add((child as Element).type);
    }
  }

  return metrics;
}

function isContainer(child: LayoutChild): child is LayoutContainer {
  return child.type === "stack" || child.type === "row" || child.type === "grid";
}

function summarizeIssues(issues: unknown): string {
  if (!Array.isArray(issues)) {
    return JSON.stringify(issues);
  }

  return issues
    .slice(0, 5)
    .map((issue) => {
      if (!issue || typeof issue !== "object") {
        return String(issue);
      }

      const record = issue as Record<string, unknown>;
      return `${record.path ?? ""}:${record.code ?? "unknown"}:${record.message ?? ""}`;
    })
    .join(" | ");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
