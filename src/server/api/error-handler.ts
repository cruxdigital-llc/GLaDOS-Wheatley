/**
 * Error Handler
 *
 * Structured error responses for the API.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const errorName = statusCode >= 500 ? 'Internal Server Error' : 'Bad Request';

  const response: ApiError = {
    statusCode,
    error: errorName,
    message: error.message,
  };

  void reply.status(statusCode).send(response);
}

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}
