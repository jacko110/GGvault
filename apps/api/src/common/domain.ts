import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { structuredLog } from './observability';

export function fail(status: number, code: string, message: string): never {
  throw new HttpException({ statusCode: status, code, message }, status);
}

export async function serializable<T>(
  db: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code) &&
        attempt < 6
      ) {
        // Preserve serializable correctness while avoiding synchronized retry storms.
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(250, 10 * 2 ** attempt) + Math.floor(Math.random() * 25),
          ),
        );
        continue;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        fail(
          409,
          'TRANSACTION_RETRY',
          'The operation conflicted with another request. Please retry.',
        );
      throw error;
    }
  }
}

export function audit(
  tx: Prisma.TransactionClient,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
) {
  return tx.auditLog.create({ data: { userId, action, entity, entityId } });
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = response.locals.requestId;
    if (
      error instanceof Error &&
      'type' in error &&
      ['entity.too.large', 'entity.parse.failed'].includes(String(error.type))
    ) {
      const statusCode = error.type === 'entity.too.large' ? 413 : 400;
      return response.status(statusCode).json({
        statusCode,
        code: `HTTP_${statusCode}`,
        message: 'Invalid request body.',
        requestId,
      });
    }
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      if (status >= 500) {
        structuredLog({
          level: 'ERROR',
          event: 'service_error',
          requestId,
          errorType: error.constructor.name,
        });
        return response.status(status).json({
          statusCode: status,
          code:
            typeof body === 'object' &&
            'code' in body &&
            [
              'EVIDENCE_INTEGRITY_ERROR',
              'NOT_READY',
              'AUTH_TEMPORARILY_UNAVAILABLE',
              'SERVICE_UNAVAILABLE',
            ].includes(String(body.code))
              ? String(body.code)
              : status === 503
                ? 'SERVICE_UNAVAILABLE'
                : 'INTERNAL_ERROR',
          message: 'Service temporarily unavailable.',
          requestId,
        });
      }
      if (typeof body === 'object' && 'code' in body)
        return response.status(status).json({ ...body, requestId });
      const message =
        typeof body === 'string'
          ? body
          : 'message' in body
            ? body.message
            : 'Request rejected';
      const code =
        message === 'Insufficient credits to lock this stake'
          ? 'LEDGER_INSUFFICIENT_FUNDS'
          : `HTTP_${status}`;
      return response
        .status(status)
        .json({ statusCode: status, code, message, requestId });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return response.status(409).json({
        statusCode: 409,
        code: 'RESOURCE_EXISTS',
        message: 'Resource already exists.',
        requestId,
      });
    }
    structuredLog({
      level: 'ERROR',
      event: 'unhandled_error',
      requestId,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorCode:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : undefined,
    });
    return response.status(500).json({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
      requestId,
    });
  }
}
