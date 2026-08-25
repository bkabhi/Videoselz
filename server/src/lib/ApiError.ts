import type { ApiErrorBody } from '@shared/api';

type FieldIssue = NonNullable<ApiErrorBody['error']['details']>[number];

/**
 * The only error type the routes throw. Carrying the status code and a stable
 * machine code on the error itself means the error middleware can serialise
 * any failure without a chain of `instanceof` checks, and the client can
 * branch on `code` instead of parsing prose.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldIssue[] | undefined;

  constructor(status: number, code: string, message: string, details?: FieldIssue[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: FieldIssue[]): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(message: string, details: FieldIssue[]): ApiError {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static tooManyRequests(message: string): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}
