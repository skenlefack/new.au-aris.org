/**
 * Turns Prisma errors caused by the request into 4xx responses instead of 500.
 */
export interface HttpError {
  statusCode: number;
  message: string;
}

export function prismaToHttp(error: unknown): HttpError | null {
  const err = error as { name?: string; code?: string; message?: string; meta?: Record<string, unknown> } | null;
  if (!err) return null;

  if (err.name === 'PrismaClientValidationError') {
    const message = err.message ?? '';
    const unknown = message.match(/Unknown argument `([^`]+)`/);
    if (unknown) return { statusCode: 400, message: `Unknown field "${unknown[1]}"` };
    const invalid = message.match(/Argument `([^`]+)`[^\n]*?(?:Invalid value|Expected)[^\n]*/);
    if (invalid) return { statusCode: 400, message: `Invalid value for field "${invalid[1]}"` };
    return { statusCode: 400, message: 'Invalid request body' };
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    switch (err.code) {
      case 'P2000': return { statusCode: 400, message: 'A value is too long for its field' };
      case 'P2002': return { statusCode: 409, message: 'A record with the same unique value already exists' };
      case 'P2003': return { statusCode: 400, message: 'A referenced record does not exist' };
      case 'P2025': return { statusCode: 404, message: 'Record not found' };
      default: return null;
    }
  }
  return null;
}
