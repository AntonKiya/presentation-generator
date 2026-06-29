import { z } from "zod";

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | {
      success: false;
      issues: ValidationIssue[];
    };

export function valid(): ValidationResult;
export function valid<T>(data: T): ValidationResult<T>;
export function valid<T>(data?: T): ValidationResult<T> | ValidationResult {
  if (arguments.length === 0) {
    return { success: true };
  }

  return {
    success: true,
    data,
  } as ValidationResult<T>;
}

export function invalid(issues: ValidationIssue[]): ValidationResult<never> {
  return {
    success: false,
    issues,
  };
}

export function createValidationIssue(
  path: string,
  code: string,
  message: string,
): ValidationIssue {
  return {
    path,
    code,
    message,
  };
}

export function normalizeZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

export function prefixValidationIssues(
  prefix: string,
  issues: ValidationIssue[],
): ValidationIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: issue.path ? `${prefix}.${issue.path}` : prefix,
  }));
}
