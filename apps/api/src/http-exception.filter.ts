import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const detail = typeof body === 'object' && body ? body as Record<string, unknown> : {};
    response.status(status).json({
      error: {
        code: detail.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
        message: detail.message ?? (status >= 500 ? '服务暂时不可用，请稍后重试。' : '请求未能完成。'),
        requestId: randomUUID(),
        ...(detail.details ? { details: detail.details } : {}),
      },
    });
  }
}
