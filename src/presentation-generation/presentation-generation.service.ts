import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AVAILABLE_ELEMENT_TYPES,
  OutlineGenerationResultSchema,
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
  type ValidationIssue,
  normalizeZodIssues,
  prefixValidationIssues,
  validatePerSlideGenerationResult,
  validateSlideTemplateLimits,
} from "./validation";
import {
  logResponseJsonSchemaComparison,
  OutlineGenerationResponseJsonSchema,
  PerSlideGenerationResponseJsonSchema,
} from "./generation/response-json-schemas";
import { normalizeSlideIds } from "./generation/slide-id-normalizer";
import { OpenRouterLlmService } from "./openrouter-llm.service";
import {
  buildOutlineMessages,
  buildPerSlideMessages,
  buildPerSlideRepairMessages,
  buildRetryMessages,
} from "./presentation-generation.prompts";
import { TemplateRegistryService } from "./template-registry.service";
import type { Template } from "./schemas/template-schema";

type AttemptDebug = {
  step: string;
  attempt: number;
  rawResponse?: string;
  issues?: ValidationIssue[] | unknown;
  model?: string;
  usage?: unknown;
};

type ValidationFunction<T> = (
  data: unknown,
) =>
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] | unknown };

type ValidatedLlmCallResult<T> =
  | {
      success: true;
      data: T;
      rawResponse: string;
      parsed: unknown;
    }
  | {
      success: false;
      issues: ValidationIssue[] | unknown;
      rawResponse: string;
      parsed: unknown;
    };

export type GenerationStatus = "success" | "partial_success";

export type GenerationIssue = ValidationIssue & {
  stage: "template_limits";
  severity: "non_blocking";
  slide_index: number;
  slide_id: string;
  template_id: string;
};

export type GeneratedSlideDebug = {
  template_id: string;
  slide: Slide;
};

export type GeneratePresentationResult = {
  status: GenerationStatus;
  issues: GenerationIssue[];
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
  private readonly maxAttempts: number;

  constructor(
    private readonly templateRegistry: TemplateRegistryService,
    private readonly llm: OpenRouterLlmService,
    config: ConfigService,
  ) {
    this.maxAttempts = getPositiveIntegerEnv(
      config,
      "PRESENTATION_GENERATION_MAX_ATTEMPTS",
      2,
    );

    this.logger.log(
      `Presentation generation configured maxAttempts=${this.maxAttempts}`,
    );
    logResponseJsonSchemaComparison(this.logger);
  }

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
      const generationIssues: GenerationIssue[] = [];

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
        generationIssues.push(
          ...this.collectSlideLimitIssues({
            slideIndex: outlineSlide.index,
            result: slideResult,
            traceId,
          }),
        );
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

      const status: GenerationStatus =
        generationIssues.length > 0 ? "partial_success" : "success";

      this.logger.log(
        `[${traceId}] Generation complete status=${status} slides=${parsedPresentation.data.slides.length} issues=${generationIssues.length} attempts=${attempts.length} durationMs=${Date.now() - startedAt}`,
      );

      return {
        status,
        issues: generationIssues,
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
      strict: false,
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

    const templates = this.templateRegistry.getTemplates();
    const messages = buildPerSlideMessages({
      fullOutline: outline,
      currentSlide,
      templates,
      availableElements: AVAILABLE_ELEMENT_TYPES,
      previousSlides,
    });

    const validate: ValidationFunction<PerSlideGenerationResult> = (input) =>
      validatePerSlideGenerationResult(
        input,
        this.templateRegistry.getRegistry(),
      );

    const generated = await this.callStructuredJsonAndValidate({
      traceId,
      step: `slide_${slideIndex}_generate`,
      attempt: 1,
      schemaName: "per_slide_generation_result",
      jsonSchema: PerSlideGenerationResponseJsonSchema,
      strict: false,
      messages,
      attempts,
      validate,
    });

    if (generated.success) {
      const result = {
        ...generated.data,
        slide: normalizeSlideIds(generated.data.slide, slideIndex),
      };
      this.logGeneratedSlide({
        traceId,
        slideIndex,
        result,
        repair: false,
      });

      return result;
    }

    let lastRawResponse = generated.rawResponse;
    let lastParsed = generated.parsed;
    let lastIssues: ValidationIssue[] | unknown = generated.issues;

    for (let attempt = 2; attempt <= this.maxAttempts; attempt += 1) {
      const selectedTemplate = this.resolveTemplateFromCandidate(lastParsed);
      const repairMessages = buildPerSlideRepairMessages({
        fullOutline: outline,
        currentSlide,
        templates,
        selectedTemplate,
        availableElements: AVAILABLE_ELEMENT_TYPES,
        previousSlides,
        rawResponse: lastRawResponse,
        issues: lastIssues,
      });

      this.logger.log(
        `[${traceId}] Slide repair start slideIndex=${slideIndex} attempt=${attempt}/${this.maxAttempts} selectedTemplate=${selectedTemplate?.id ?? "unresolved"}`,
      );

      const repaired = await this.callStructuredJsonAndValidate({
        traceId,
        step: `slide_${slideIndex}_repair`,
        attempt,
        schemaName: "per_slide_generation_result",
        jsonSchema: PerSlideGenerationResponseJsonSchema,
        strict: false,
        messages: repairMessages,
        attempts,
        validate,
      });

      if (repaired.success) {
        const result = {
          ...repaired.data,
          slide: normalizeSlideIds(repaired.data.slide, slideIndex),
        };
        this.logGeneratedSlide({
          traceId,
          slideIndex,
          result,
          repair: true,
        });

        return result;
      }

      lastRawResponse = repaired.rawResponse;
      lastParsed = repaired.parsed;
      lastIssues = repaired.issues;
    }

    this.logger.error(
      `[${traceId}] Slide generation failed slideIndex=${slideIndex} attempts=${this.maxAttempts} issues=${summarizeIssues(lastIssues)}`,
    );

    throw new UnprocessableEntityException({
      message: `slide_${slideIndex} generation failed validation after repair attempts`,
      issues: lastIssues,
      attempts,
    });
  }

  private resolveTemplateFromCandidate(
    candidate: unknown,
  ): Template | undefined {
    if (!isRecord(candidate) || typeof candidate.template_id !== "string") {
      return undefined;
    }

    return this.templateRegistry.getTemplateById(candidate.template_id);
  }

  private logGeneratedSlide(input: {
    traceId: string;
    slideIndex: number;
    result: PerSlideGenerationResult;
    repair: boolean;
  }): void {
    const metrics = inspectSlide(input.result.slide);
    const action = input.repair ? "repaired" : "generated";

    this.logger.log(
      `[${input.traceId}] Slide ${action} slideIndex=${input.slideIndex} slideId=${input.result.slide.id} template=${input.result.template_id} containers=${metrics.containers} elements=${metrics.elements} elementTypes=${metrics.elementTypes.join(",")}`,
    );
  }

  private collectSlideLimitIssues(input: {
    slideIndex: number;
    result: PerSlideGenerationResult;
    traceId: string;
  }): GenerationIssue[] {
    const template = this.templateRegistry.getTemplateById(
      input.result.template_id,
    );

    if (!template) {
      return [];
    }

    const limitValidation = validateSlideTemplateLimits(
      input.result.slide,
      template,
    );

    if (limitValidation.success) {
      return [];
    }

    const prefixedIssues = prefixValidationIssues(
      "slide",
      limitValidation.issues,
    );
    const issues = prefixedIssues.map((issue) => ({
      ...issue,
      stage: "template_limits" as const,
      severity: "non_blocking" as const,
      slide_index: input.slideIndex,
      slide_id: input.result.slide.id,
      template_id: input.result.template_id,
    }));

    this.logger.warn(
      `[${input.traceId}] Slide template limits exceeded slideIndex=${input.slideIndex} slideId=${input.result.slide.id} template=${input.result.template_id} issues=${summarizeIssues(issues)}`,
    );

    return issues;
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
    validate: ValidationFunction<T>;
  }): Promise<T> {
    let messages = input.messages;
    let lastIssues: ValidationIssue[] | unknown = [];
    let lastRawResponse = "";

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const result = await this.callStructuredJsonAndValidate({
        traceId: input.traceId,
        step: input.step,
        attempt,
        schemaName: input.schemaName,
        jsonSchema: input.jsonSchema,
        strict: input.strict,
        messages,
        attempts: input.attempts,
        validate: input.validate,
      });

      if (result.success) {
        return result.data;
      }

      lastIssues = result.issues;
      lastRawResponse = result.rawResponse;
      messages = buildRetryMessages({
        originalMessages: input.messages,
        rawResponse: result.rawResponse,
        issues: result.issues,
      });

      if (attempt < this.maxAttempts) {
        this.logger.log(`[${input.traceId}] ${input.step} retry scheduled`);
      }
    }

    this.logger.error(
      `[${input.traceId}] ${input.step} failed after retry issues=${summarizeIssues(lastIssues)}`,
    );

    throw new UnprocessableEntityException({
      message: `${input.step} generation failed validation after retry`,
      issues: lastIssues,
      rawResponse: lastRawResponse,
      attempts: input.attempts,
    });
  }

  private async callStructuredJsonAndValidate<T>(input: {
    traceId: string;
    step: string;
    attempt: number;
    schemaName: string;
    jsonSchema: Record<string, unknown>;
    strict: boolean;
    messages: Parameters<
      OpenRouterLlmService["generateStructuredJson"]
    >[0]["messages"];
    attempts: AttemptDebug[];
    validate: ValidationFunction<T>;
  }): Promise<ValidatedLlmCallResult<T>> {
    this.logger.log(
      `[${input.traceId}] ${input.step} attempt=${input.attempt}/${this.maxAttempts} start schema=${input.schemaName} strict=${input.strict} messages=${input.messages.length}`,
    );

    const response = await this.llm.generateStructuredJson({
      traceId: input.traceId,
      schemaName: input.schemaName,
      jsonSchema: input.jsonSchema,
      strict: input.strict,
      messages: input.messages,
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
      attempt: input.attempt,
      rawResponse: response.rawText,
      issues: validationResult.success ? undefined : validationResult.issues,
      model: response.model,
      usage: response.usage,
    });

    if (validationResult.success) {
      this.logger.log(
        `[${input.traceId}] ${input.step} attempt=${input.attempt}/${this.maxAttempts} valid rawChars=${response.rawText.length}`,
      );

      return {
        success: true,
        data: validationResult.data,
        rawResponse: response.rawText,
        parsed: response.parsed,
      };
    }

    this.logger.warn(
      `[${input.traceId}] ${input.step} attempt=${input.attempt}/${this.maxAttempts} invalid rawChars=${response.rawText.length} issues=${summarizeIssues(validationResult.issues)}`,
    );

    return {
      success: false,
      issues: validationResult.issues,
      rawResponse: response.rawText,
      parsed: response.parsed,
    };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPositiveIntegerEnv(
  config: ConfigService,
  name: string,
  fallback: number,
): number {
  const value = config.get<string>(name);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
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
