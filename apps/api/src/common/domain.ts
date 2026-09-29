import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';

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
        attempt < 4
      )
        continue;
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
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      if (typeof body === 'object' && 'code' in body)
        return response.status(status).json(body);
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
        .json({ statusCode: status, code, message });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return response
        .status(409)
        .json({
          statusCode: 409,
          code: 'RESOURCE_EXISTS',
          message: 'Resource already exists.',
        });
    }
    return response
      .status(500)
      .json({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
      });
  }
}
