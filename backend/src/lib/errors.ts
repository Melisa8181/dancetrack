export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') => new HttpError(400, code, message);
export const unauthorized = (message = 'Necesitás iniciar sesión.') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'No tenés permiso para realizar esta acción.', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const notFound = (message = 'Recurso no encontrado.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);
