import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { LeanIxException } from '../exceptions/leanix.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType<'graphql'>() === 'graphql') {
      // Let Apollo's error pipeline handle it (see graphql-error-formatter.ts) — the GraphQL
      // execution context has no Express response to write an HTTP status/body to.
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof LeanIxException) {
      response.status(exception.httpStatus).json({
        error: exception.code,
        error_description: exception.message,
        ...(exception.details ?? {}),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const description = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      response.status(status).json({
        error: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        error_description: Array.isArray(description) ? description.join(', ') : description ?? exception.message,
      });
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    response.status(500).json({
      error: 'INTERNAL_ERROR',
      error_description: 'An unexpected error occurred',
    });
  }
}
