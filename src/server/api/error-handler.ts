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

const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const errorName = STATUS_NAMES[statusCode] ?? (statusCode >= 500 ? 'Server Error' : 'Client Error');

  const response: ApiError = {
    statusCode,
    error: errorName,
    message: error.message,
  };

  void reply.status(statusCode).send(response);
}
