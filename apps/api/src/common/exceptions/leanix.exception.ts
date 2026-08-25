import { ErrorCode, ERROR_HTTP_STATUS } from '@leanix-mock/shared';

export class LeanIxException extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.details = details;
    this.name = 'LeanIxException';
  }
}
