import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message as string) || exception.message;
      if (Array.isArray(message)) message = message[0] ?? '参数校验失败';
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    res.status(status).json({ code: status, data: null, message });
  }
}
