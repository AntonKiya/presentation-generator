import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type StructuredLlmRequest = {
  traceId?: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  messages: ChatCompletionMessageParam[];
  strict?: boolean;
  temperature?: number;
  maxTokens?: number;
};

export type StructuredLlmResponse = {
  rawText: string;
  parsed: unknown;
  parseError?: string;
  model: string;
  usage?: unknown;
};

@Injectable()
export class OpenRouterLlmService {
  private readonly logger = new Logger(OpenRouterLlmService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly requireParameters: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.requireEnv("OPENROUTER_API_KEY");
    const baseURL =
      this.config.get<string>("OPENROUTER_BASE_URL") ??
      "https://openrouter.ai/api/v1";

    this.model = this.requireEnv("OPENROUTER_MODEL");
    this.temperature = this.getNumberEnv("OPENROUTER_TEMPERATURE", 0.35);
    this.maxTokens = this.getNumberEnv("OPENROUTER_MAX_TOKENS", 6000);
    this.requireParameters = this.getBooleanEnv(
      "OPENROUTER_REQUIRE_PARAMETERS",
      true,
    );

    this.client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: this.buildDefaultHeaders(),
    });

    this.logger.log(
      `OpenRouter client configured model=${this.model} baseURL=${baseURL} temperature=${this.temperature} maxTokens=${this.maxTokens} requireParameters=${this.requireParameters}`,
    );
  }

  async generateStructuredJson(
    request: StructuredLlmRequest,
  ): Promise<StructuredLlmResponse> {
    const startedAt = Date.now();
    const tracePrefix = formatTracePrefix(request.traceId);
    const temperature = request.temperature ?? this.temperature;
    const maxTokens = request.maxTokens ?? this.maxTokens;

    this.logger.log(
      `${tracePrefix}OpenRouter request start schema=${request.schemaName} strict=${request.strict ?? false} model=${this.model} messages=${request.messages.length} temperature=${temperature} maxTokens=${maxTokens}`,
    );

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: request.messages,
        temperature,
        max_tokens: maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: request.schemaName,
            strict: request.strict ?? false,
            schema: request.jsonSchema,
          },
        },
        provider: {
          require_parameters: this.requireParameters,
        },
      } as any);

      const rawText = response.choices[0]?.message?.content;

      if (!rawText) {
        throw new Error("OpenRouter returned an empty response");
      }

      const parsedResponse = safeParseJsonResponse(rawText);
      const durationMs = Date.now() - startedAt;

      if (parsedResponse.parseError) {
        this.logger.warn(
          `${tracePrefix}OpenRouter response parse failed schema=${request.schemaName} durationMs=${durationMs} rawChars=${rawText.length} error=${parsedResponse.parseError}`,
        );
      } else {
        this.logger.log(
          `${tracePrefix}OpenRouter response ok schema=${request.schemaName} durationMs=${durationMs} rawChars=${rawText.length} usage=${formatUsage(response.usage)}`,
        );
      }

      return {
        rawText,
        ...parsedResponse,
        model: response.model,
        usage: response.usage,
      };
    } catch (error) {
      this.logger.error(
        `${tracePrefix}OpenRouter request failed schema=${request.schemaName} durationMs=${Date.now() - startedAt} error=${formatError(error)}`,
      );
      throw error;
    }
  }

  private buildDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const siteUrl = this.config.get<string>("OPENROUTER_SITE_URL");
    const appName = this.config.get<string>("OPENROUTER_APP_NAME");

    if (siteUrl) {
      headers["HTTP-Referer"] = siteUrl;
    }

    if (appName) {
      headers["X-Title"] = appName;
    }

    return headers;
  }

  private requireEnv(name: string): string {
    const value = this.config.get<string>(name);

    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  }

  private getNumberEnv(name: string, fallback: number): number {
    const value = this.config.get<string>(name);

    if (!value) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new Error(`${name} must be a number`);
    }

    return parsed;
  }

  private getBooleanEnv(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name);

    if (!value) {
      return fallback;
    }

    return value.toLowerCase() === "true";
  }
}

function formatTracePrefix(traceId: string | undefined): string {
  return traceId ? `[${traceId}] ` : "";
}

function formatUsage(usage: unknown): string {
  if (!usage || typeof usage !== "object") {
    return "n/a";
  }

  const record = usage as Record<string, unknown>;

  return JSON.stringify({
    prompt_tokens: record.prompt_tokens,
    completion_tokens: record.completion_tokens,
    total_tokens: record.total_tokens,
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeParseJsonResponse(rawText: string): {
  parsed: unknown;
  parseError?: string;
} {
  try {
    return {
      parsed: parseJsonResponse(rawText),
    };
  } catch (error) {
    return {
      parsed: undefined,
      parseError: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function parseJsonResponse(rawText: string): unknown {
  const trimmed = rawText.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1]);
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("Response is not valid JSON");
  }
}
