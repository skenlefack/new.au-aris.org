/**
 * Shared helpers for hub route handlers.
 */
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

/** Standard pagination defaults */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

/** Parse common pagination + filter query params */
export function parsePagination(request: FastifyRequest): {
  page: number;
  limit: number;
  skip: number;
} {
  const qs = request.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(qs.page ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit ?? '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/** Build standard paginated response */
export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

/** Get query string value */
export function qs(request: FastifyRequest, key: string): string | undefined {
  return (request.query as Record<string, string | undefined>)[key];
}

/** Get authenticated user from request */
export function getUser(request: FastifyRequest): AuthenticatedUser {
  return request.user as AuthenticatedUser;
}

/** HTTP error helper */
export class HttpError extends Error {
  statusCode: number;
  errors?: unknown[];

  constructor(statusCode: number, message: string, errors?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function notFound(entity: string): HttpError {
  return new HttpError(404, `${entity} not found`);
}

export function forbidden(message = 'Forbidden'): HttpError {
  return new HttpError(403, message);
}
