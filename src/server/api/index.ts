/**
 * API — barrel export
 */

export { createServer, type ServerOptions } from './server.js';
export { BoardService } from './board-service.js';
export { errorHandler, NotFoundError, BadRequestError } from './error-handler.js';
