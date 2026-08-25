import { GraphQLFormattedError } from 'graphql';
import { LeanIxException } from '../common/exceptions/leanix.exception';

export function formatGraphQLError(formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  const original = (error as { originalError?: unknown })?.originalError ?? error;

  if (original instanceof LeanIxException) {
    return {
      message: original.message,
      extensions: {
        code: original.code,
        ...(original.details ?? {}),
      },
    };
  }

  // Nest HttpException (e.g. UnauthorizedException from guards) surfaces here too.
  const maybeHttp = original as { getStatus?: () => number; message?: unknown; response?: unknown };
  if (typeof maybeHttp?.getStatus === 'function') {
    const status = maybeHttp.getStatus();
    const code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : undefined;
    if (code) {
      return {
        message: formattedError.message,
        extensions: { code },
      };
    }
  }

  return formattedError;
}
